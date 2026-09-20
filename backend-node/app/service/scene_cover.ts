'use strict';

const Service = require('egg').Service;
const path = require('node:path');
const {
  sanitizeFileName,
  storyboardPreviewSpec,
  downloadAndStore,
  createPreviewFromLocalPath,
} = require('../lib/media');
const { generateSeedreamImage } = require('../lib/ai_clients');

import type { ImageReferenceItem, ReferenceMapping, VideoFrameReferenceItem } from '../lib/entity';
const { GENERATION_STATUS, MEDIA_TYPE } = require('../lib/domain_constants');

class SceneCoverService extends Service {
  /**
   * 预览场景封面生成参数和 prompt。
   * @param {number} id 场景 id，例如 `21`。
   * @returns {Promise<object>} 预览信息，包含字段摘要、模板和最终 prompt。
   * @example
   * await service.previewCoverGeneration(21)
   * // => { action: "scene-cover", model: "seedream-4.5", final_prompt: "..." }
   */
  async previewCoverGeneration(id: number, _selectedModel: string = '') {
    const scene = await this.ctx.service.scene.findById(id);
    if (!scene) {
      throw new Error('scene not found');
    }
    const prompt = this.ctx.service.sceneReference.buildCoverPrompt(scene);
    const referenceState: {
      reference_images: Array<ImageReferenceItem | VideoFrameReferenceItem>;
      missing_references: string[];
      mappings: ReferenceMapping[];
      bound_without_mentions: string[];
      unbound_mentions: string[];
      recognized_bound_mentions: string[];
    } = await this.ctx.service.sceneReference.generationReferencesForScene(scene);
    const finalPrompt = this.ctx.service.sceneReference.buildReferenceMappedPrompt(
      prompt,
      referenceState.mappings,
    );
    return {
      prompt_mode: 'composite',
      mode: referenceState.reference_images.length ? 'reference' : 'text-only',
      model: this.app.config.storyboard.seedreamImageModel || 'seedream-4.5',
      ...referenceState,
      fields: {
        scene_title: String(scene.title || '').trim(),
        location: String(scene.location || '').trim(),
        time_of_day: String(scene.time_of_day || '').trim(),
        content: String(scene.prompt || '').trim(),
        characters: scene.character_names || [],
      },
      template: 'composite-first-shot',
      prompt_blueprint: null,
      final_prompt: finalPrompt,
      can_generate_without_references: true,
    };
  }

  /**
   * 真正生成场景封面，并回写封面图和预览图。
   * @param {number} id 场景 id，例如 `21`。
   * @returns {Promise<object>} 更新后的场景对象。
   * @example
   * await service.generateCover(21)
   * // => { id: 21, cover_url: "/generated/scene-covers/scene-21-....png" }
   */
  async generateCover(id: number, selectedModel: string = '', useTextOnly: boolean = false) {
    const scene = await this.ctx.service.scene.findById(id);
    if (!scene) {
      throw new Error('scene not found');
    }
    // 事务抢占：锁场景行后复查有无进行中的封面任务，
    // 输家直接返回现状，不建新任务。
    const conn = await this.app.mysqlPool.getConnection();
    try {
      await conn.beginTransaction();
      const [parents] = await conn.query(
        'SELECT id FROM scenes WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
        [id],
      );
      if (!parents.length) throw new Error('scene not found');
      const [running] = await conn.query(
        'SELECT id FROM scene_media_generations WHERE scene_id = ? AND media_type = ? AND status = ? LIMIT 1',
        [id, MEDIA_TYPE.COVER, GENERATION_STATUS.GENERATING],
      );
      await conn.commit();
      if (running.length) {
        return scene;
      }
    } finally {
      conn.release();
    }
    const preview = await this.previewCoverGeneration(id, selectedModel);
    const generation = await this.ctx.service.sceneMediaGeneration.create({
      scene_id: id,
      media_type: MEDIA_TYPE.COVER,
      model: preview.model,
      status: GENERATION_STATUS.GENERATING,
      source_url: preview.reference_images[0]?.url || null,
      meta_json: JSON.stringify({
        prompt_mode: 'composite',
        reference_count: preview.reference_images.length,
        generation_mode: useTextOnly ? 'text-only' : preview.mode,
      }),
    });
    let stored;
    let previewPath;
    try {
      const imageUrl = await generateSeedreamImage(
        this.app,
        preview.final_prompt,
        useTextOnly ? [] : preview.reference_images.map((item) => item.url),
      );
      const filename = `${sanitizeFileName(`scene-${id}`)}-${Date.now()}.png`;
      stored = await downloadAndStore(this.app, imageUrl, 'scene-covers', filename, 'image/png');
      const previewFilename = `${path.basename(filename, path.extname(filename))}.thumb.webp`;
      previewPath = await createPreviewFromLocalPath(
        this.app,
        stored.localPath,
        'scene-covers',
        previewFilename,
        storyboardPreviewSpec(),
      );
      await this.ctx.service.scene.update(id, {
        cover_url: stored.publicPath,
        cover_preview_url: previewPath,
      });
      await this.ctx.service.sceneMediaGeneration.update(generation.id, {
        status: GENERATION_STATUS.SUCCEEDED,
        result_url: stored.publicPath,
        preview_url: previewPath,
        error_message: null,
      });
      await this.ctx.service.sceneMediaGeneration.markCurrent(id, MEDIA_TYPE.COVER, generation.id);
      return await this.ctx.service.scene.findById(id);
    } catch (error) {
      await this.ctx.service.sceneMediaGeneration.update(generation.id, {
        status: GENERATION_STATUS.FAILED,
        error_message: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 批量为场景下所有镜头生成封面。
   * @param {number} id 场景 id，例如 `21`。
   * @returns {Promise<object>} 批量结果，包含成功数量和失败项。
   * @example
   * await service.generateStoryboardCovers(21)
   * // => { generated_count: 8, failed: [] }
   */
  async generateStoryboardCovers(id: number) {
    const storyboards = await this.ctx.service.storyboard.findBySceneId(id);
    const failed = [];
    let generatedCount = 0;
    for (const storyboard of storyboards) {
      try {
        await this.ctx.service.storyboardCover.generateCover(storyboard.id, '', false);
        generatedCount++;
      } catch (error) {
        failed.push({ storyboard_id: storyboard.id, error: (error as Error).message });
      }
    }
    return {
      scene: await this.ctx.service.scene.findById(id),
      storyboards: await this.ctx.service.storyboard.findBySceneId(id),
      generated_count: generatedCount,
      failed,
    };
  }
}

module.exports = SceneCoverService;
