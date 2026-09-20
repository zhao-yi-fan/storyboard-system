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
const { normalizeGeneratedAssetReference } = require('../lib/generated_asset');
import type { ImageReferenceItem } from '../lib/entity';
const { buildStoryboardCoverPrompt } = require('../lib/prompt_library');
const {
  extractFirstShotCoverPrompt,
  isCompositeStoryboardPrompt,
} = require('../lib/composite_prompt');
const { ASSET_SOURCE_TYPE, GENERATION_STATUS, MEDIA_TYPE } = require('../lib/domain_constants');

class StoryboardCoverService extends Service {
  async previewCoverGeneration(id: number, selectedModel: string) {
    if (!this.supportedCoverModels().has(String(selectedModel || '').trim())) {
      throw new Error('unsupported cover model');
    }
    const storyboard = await this.ctx.service.storyboard.findById(id);
    if (!storyboard) {
      throw new Error('storyboard not found');
    }
    const scene = await this.ctx.service.scene.findById(storyboard.scene_id);
    if (!scene) {
      throw new Error('scene not found');
    }
    const { references, missing }: { references: ImageReferenceItem[]; missing: string[] } =
      await this.ctx.service.storyboardReference.selectReferenceImages(storyboard, scene);
    const model = this.app.config.storyboard.seedreamImageModel || 'seedream-4.5';
    const mode = references.length ? 'reference' : 'text-only';
    const fields = {
      scene_title: String(scene.title || '').trim(),
      location: String(scene.location || '').trim(),
      time_of_day: String(scene.time_of_day || '').trim(),
      background: String(storyboard.background || '').trim(),
      characters: storyboard.character_names.slice(),
      shot_type: String(storyboard.shot_type || '').trim(),
      camera_direction: String(storyboard.camera_direction || '').trim(),
      content: String(storyboard.content || '').trim(),
      mood: String(storyboard.mood || '').trim(),
      style_preset: this.ctx.service.storyboardReference.resolveStoryboardStylePreset(
        scene,
        storyboard,
      ),
      style_notes: this.ctx.service.storyboardReference.resolveStoryboardStyleNotes(
        scene,
        storyboard,
      ),
      dialogue: String(storyboard.dialogue || '').trim(),
      notes: String(storyboard.notes || '').trim(),
    };
    const composite = isCompositeStoryboardPrompt(fields.content);
    const coverPrompt = composite
      ? {
          template: 'composite-first-shot',
          blueprint: null,
          prompt: extractFirstShotCoverPrompt(fields.content),
        }
      : buildStoryboardCoverPrompt(fields, references);
    return {
      prompt_mode: composite ? 'composite' : 'legacy',
      mode,
      model,
      reference_images: references.map((item) => ({
        type: item.type,
        name: item.name,
        url: item.url,
        source: item.source,
      })),
      missing_references: missing,
      fields,
      template: coverPrompt.template,
      prompt_blueprint: coverPrompt.blueprint,
      final_prompt: coverPrompt.prompt,
      can_generate_without_references: true,
    };
  }

  async generateCover(id: number, selectedModel: string, useTextOnly: boolean) {
    const preview = await this.previewCoverGeneration(id, selectedModel);
    const generation = await this.ctx.service.mediaGeneration.create({
      storyboard_id: id,
      media_type: MEDIA_TYPE.COVER,
      model: preview.model,
      status: GENERATION_STATUS.GENERATING,
      source_url: preview.reference_images[0]?.url || null,
      meta_json: JSON.stringify({
        resolution: '1024x576',
        preview_format: 'webp',
        preview_width: 480,
        reference_count: preview.reference_images.length,
        reference_types: preview.reference_images.map((item) => item.type),
        generation_mode: useTextOnly ? 'text-only' : preview.mode,
      }),
    });

    try {
      const imageUrl = await generateSeedreamImage(
        this.app,
        preview.final_prompt,
        useTextOnly ? [] : preview.reference_images.map((item) => item.url),
      );
      const filename = `${sanitizeFileName(`storyboard-${id}`)}-${Date.now()}.png`;
      const stored = await downloadAndStore(this.app, imageUrl, 'covers', filename, 'image/png');
      const previewFilename = `${path.basename(filename, path.extname(filename))}.thumb.webp`;
      const previewPath = await createPreviewFromLocalPath(
        this.app,
        stored.localPath,
        'covers',
        previewFilename,
        storyboardPreviewSpec(),
      );

      await this.ctx.service.storyboard.update(id, {
        thumbnail_url: stored.publicPath,
        thumbnail_preview_url: previewPath,
      });

      await this.ctx.service.mediaGeneration.update(generation.id, {
        status: GENERATION_STATUS.SUCCEEDED,
        result_url: stored.publicPath,
        preview_url: previewPath,
        error_message: null,
      });
      await this.ctx.service.mediaGeneration.markCurrent(id, MEDIA_TYPE.COVER, generation.id);

      const storyboardAfter = await this.ctx.service.storyboard.findById(id);
      if (!storyboardAfter) throw new Error('storyboard not found');
      return {
        storyboard_id: storyboardAfter.id,
        thumbnail_url: storyboardAfter.thumbnail_url,
        thumbnail_preview_url: storyboardAfter.thumbnail_preview_url,
        storyboard: storyboardAfter,
      };
    } catch (error) {
      await this.ctx.service.mediaGeneration.update(generation.id, {
        status: GENERATION_STATUS.FAILED,
        error_message: (error as Error).message,
      });
      throw error;
    }
  }

  async uploadCover(id: number, thumbnailUrl: string) {
    const storyboard = await this.ctx.service.storyboard.findById(id);
    if (!storyboard) {
      throw new Error('storyboard not found');
    }
    const normalizedThumbnailUrl = normalizeGeneratedAssetReference(
      this.app,
      String(thumbnailUrl || '').trim(),
    );
    if (!normalizedThumbnailUrl) {
      throw new Error('thumbnail_url is required');
    }

    const generation = await this.ctx.service.mediaGeneration.create({
      storyboard_id: id,
      media_type: MEDIA_TYPE.COVER,
      model: ASSET_SOURCE_TYPE.MANUAL_UPLOAD,
      status: GENERATION_STATUS.SUCCEEDED,
      result_url: normalizedThumbnailUrl,
      preview_url: normalizedThumbnailUrl,
      source_url: normalizedThumbnailUrl,
      is_current: false,
      meta_json: JSON.stringify({ source: ASSET_SOURCE_TYPE.MANUAL_UPLOAD }),
    });
    await this.ctx.service.mediaGeneration.markCurrent(id, MEDIA_TYPE.COVER, generation.id);
    const nextStoryboard = await this.ctx.service.storyboardVideo.applyMediaGeneration(
      id,
      generation,
    );
    return {
      storyboard: nextStoryboard,
      media_generations: await this.ctx.service.mediaGeneration.listByStoryboardId(id),
    };
  }
}

module.exports = StoryboardCoverService;
