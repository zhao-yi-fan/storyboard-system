'use strict';

const Service = require('egg').Service;
const { normalizeGeneratedAssetReference } = require('../lib/generated_asset');

class SceneMediaLibraryService extends Service {
  async list(sceneId) {
    if (!(await this.ctx.service.scene.findById(sceneId))) throw new Error('scene not found');
    const generations = await this.ctx.service.sceneMediaGeneration.listBySceneId(sceneId);
    return await this.ctx.service.sceneVideoFrame.attachToGenerations(generations);
  }

  async apply(sceneId, generation) {
    if (!generation || Number(generation.scene_id) !== Number(sceneId)) {
      throw new Error('scene media generation not found');
    }
    if (generation.media_type === 'cover') {
      return await this.ctx.service.scene.update(sceneId, {
        cover_url: generation.result_url || '',
        cover_preview_url: generation.preview_url || generation.result_url || '',
      });
    }
    if (generation.media_type === 'video') {
      const posterUrl = await this.ctx.service.sceneVideoPoster.ensureBestEffort(generation);
      return await this.ctx.service.scene.update(sceneId, {
        video_url: generation.result_url || '',
        video_preview_url: generation.preview_url || generation.result_url || '',
        video_poster_url: posterUrl,
        video_status: generation.status || '',
        video_error: generation.error_message || '',
      });
    }
    throw new Error('unsupported media type');
  }

  async setCurrent(sceneId, generationId) {
    const generation = await this.ctx.service.sceneMediaGeneration.findById(generationId);
    if (!generation || Number(generation.scene_id) !== Number(sceneId)) {
      throw new Error('scene media generation not found');
    }
    if (generation.status !== 'succeeded' || !generation.result_url) {
      throw new Error('只有生成成功且存在结果文件的媒体版本才能设为当前版本');
    }
    await this.ctx.service.sceneMediaGeneration.markCurrent(
      sceneId,
      generation.media_type,
      generationId,
    );
    const scene = await this.apply(sceneId, generation);
    return { scene, media_generations: await this.list(sceneId) };
  }

  async remove(sceneId, generationId) {
    const generation = await this.ctx.service.sceneMediaGeneration.findById(generationId);
    if (!generation || Number(generation.scene_id) !== Number(sceneId)) {
      throw new Error('scene media generation not found');
    }
    await this.ctx.service.sceneMediaGeneration.softDelete(generationId);
    const remaining = await this.list(sceneId);
    if (generation.is_current) {
      const replacement = remaining.find(
        (item) =>
          item.media_type === generation.media_type &&
          item.status === 'succeeded' &&
          item.result_url,
      );
      if (replacement) {
        await this.ctx.service.sceneMediaGeneration.markCurrent(
          sceneId,
          generation.media_type,
          replacement.id,
        );
        await this.apply(sceneId, replacement);
      } else if (generation.media_type === 'cover') {
        await this.ctx.service.scene.update(sceneId, {
          cover_url: '',
          cover_preview_url: '',
        });
      } else {
        await this.ctx.service.scene.update(sceneId, {
          video_url: '',
          video_preview_url: '',
          video_poster_url: '',
          video_status: '',
          video_error: '',
        });
      }
    }
    return {
      scene: await this.ctx.service.scene.findById(sceneId),
      media_generations: await this.list(sceneId),
    };
  }

  async uploadCover(sceneId, coverUrl) {
    if (!(await this.ctx.service.scene.findById(sceneId))) throw new Error('scene not found');
    const normalized = normalizeGeneratedAssetReference(
      this.app,
      String(coverUrl || '').trim(),
    );
    if (!normalized) throw new Error('cover_url is required');
    const generation = await this.ctx.service.sceneMediaGeneration.create({
      scene_id: sceneId,
      media_type: 'cover',
      model: 'manual-upload',
      status: 'succeeded',
      result_url: normalized,
      preview_url: normalized,
      source_url: normalized,
      meta_json: JSON.stringify({ source: 'manual-upload' }),
    });
    await this.ctx.service.sceneMediaGeneration.markCurrent(sceneId, 'cover', generation.id);
    await this.apply(sceneId, generation);
    return {
      scene: await this.ctx.service.scene.findById(sceneId),
      media_generations: await this.list(sceneId),
    };
  }
}

module.exports = SceneMediaLibraryService;
