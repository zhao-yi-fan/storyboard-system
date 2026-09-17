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
const {
  assertCompositePromptLength,
  extractFirstShotCoverPrompt,
} = require('../lib/composite_prompt');
const {
  GENERATION_STATUS,
  MEDIA_TYPE,
} = require('../lib/domain_constants');

class SceneCoverService extends Service {
  buildCoverPrompt(scene: any) {
    const prompt = assertCompositePromptLength(scene.prompt || scene.description || '');
    if (!prompt) throw new Error('片段 Prompt 不能为空');
    return extractFirstShotCoverPrompt(prompt);
  }

  buildGenerationReferenceState(scene: any, references: any[], missing: any[], projectReferenceNames: any[] = []) {
    const prompt = String(scene.prompt || scene.description || '');
    const boundNames = new Set(
      [
        ...(Array.isArray(scene.characters) ? scene.characters : []),
        ...(Array.isArray(scene.assets) ? scene.assets : []),
        ...(Array.isArray(scene.video_frame_references) ? scene.video_frame_references : []),
      ]
        .map((item: any) => String(item.name || '').trim())
        .filter(Boolean),
    );
    const typeLabels: Record<string, string> = {
      character: '角色主设定图',
      scene: '场景参考图',
      prop: '道具参考图',
      costume: '服装参考图',
      asset: '图片参考',
      video_frame: '视频抽帧',
    };
    const mappings = references.map((reference: any, index: any) => {
      const name = String(reference.name || '').trim();
      const mention = name ? `@${name}` : '';
      const isMentioned = !!mention && prompt.includes(mention);
      const subject = `${typeLabels[reference.type] || '图片参考'}「${name}」`;
      return {
        index: index + 1,
        name,
        type: reference.type,
        source: reference.source,
        mention,
        is_mentioned: isMentioned,
        prompt_text: isMentioned
          ? `参考图${index + 1}：${subject}，对应 Prompt 中的 ${mention}。`
          : `参考图${index + 1}：${subject}，作为当前片段已绑定的视觉参考。`,
      };
    });
    const boundWithoutMentions = mappings
      .filter((mapping: any) => !mapping.is_mentioned)
      .map((mapping: any) => mapping.name);
    const knownNames = Array.from(
      new Set(projectReferenceNames.map((name: any) => String(name || '').trim()).filter(Boolean)),
    );
    const unboundMentions = knownNames.filter(
      (name: any) => prompt.includes(`@${name}`) && !boundNames.has(name),
    );

    return {
      reference_images: references,
      missing_references: missing,
      mappings,
      bound_without_mentions: boundWithoutMentions,
      unbound_mentions: unboundMentions,
      recognized_bound_mentions: Array.from(boundNames).filter((name: any) =>
        prompt.includes(`@${name}`),
      ),
    };
  }

  async generationReferencesForScene(scene: any) {
    const [{ references, missing }, characters, assets] = await Promise.all([
      this.ctx.service.storyboard.selectReferenceImages(scene, scene),
      this.ctx.service.character.findByProjectId(scene.project_id),
      this.ctx.service.asset.findByProjectId(scene.project_id),
    ]);
    const frameReferences = this.buildVideoFrameReferences(scene.video_frame_references || []);
    return this.buildGenerationReferenceState(
      scene,
      [...references, ...frameReferences],
      missing,
      [...characters, ...assets].map((item: any) => item.name),
    );
  }

  buildVideoFrameReferences(frames: any[]) {
    return frames.map((frame: any) => {
      const seconds = (Number(frame.timestamp_ms || 0) / 1000).toFixed(1);
      const sceneTitle = String(frame.source_scene_title || `片段${frame.source_scene_id}`);
      return {
        type: 'video_frame',
        name: `${sceneTitle} ${seconds}s 抽帧`,
        url: frame.file_url,
        source: `来源片段「${sceneTitle}」的视频版本 #${frame.source_generation_id}，时间点 ${seconds}s`,
        frame_id: frame.id,
      };
    });
  }

  async generationReferences(id: number) {
    const scene = await this.ctx.service.scene.findById(id);
    if (!scene) throw new Error('scene not found');
    return await this.generationReferencesForScene(scene);
  }

  buildReferenceMappedPrompt(prompt: string, mappings: any[]) {
    if (!mappings.length) return prompt;
    return `【参考图对应关系】\n${mappings.map((mapping: any) => mapping.prompt_text).join('\n')}\n\n${prompt}`;
  }

  async previewCoverGeneration(id: number, _selectedModel: string = '') {
    const scene = await this.ctx.service.scene.findById(id);
    if (!scene) {
      throw new Error('scene not found');
    }
    const prompt = this.buildCoverPrompt(scene);
    const referenceState = await this.generationReferencesForScene(scene);
    const finalPrompt = this.buildReferenceMappedPrompt(prompt, referenceState.mappings);
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

  async generateCover(id: number, selectedModel: string = '', useTextOnly: boolean = false) {
    const scene = await this.ctx.service.scene.findById(id);
    if (!scene) {
      throw new Error('scene not found');
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
        useTextOnly ? [] : preview.reference_images.map((item: any) => item.url),
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
      await this.ctx.service.scene.update(id, { cover_url: stored.publicPath, cover_preview_url: previewPath });
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

  async generateStoryboardCovers(id: number) {
    const storyboards = await this.ctx.service.storyboard.findBySceneId(id);
    const failed = [];
    let generatedCount = 0;
    for (const storyboard of storyboards) {
      try {
        await this.ctx.service.storyboard.generateCover(storyboard.id, '', false);
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
