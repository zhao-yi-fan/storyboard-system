'use strict';
// @ts-nocheck

const Service = require('egg').Service;
const {
  deleteGeneratedAsset,
  normalizeGeneratedAssetReference,
} = require('../lib/generated_asset');
const { trimVideo } = require('../lib/media');
const { parseMediaGenerationMeta } = require('../lib/media_generation_meta');

class SceneVideoClipService extends Service {
  normalizeRange(scene, generation, startMsRaw, endMsRaw) {
    const startMs = Math.round(Number(startMsRaw) / 100) * 100;
    const endMs = Math.round(Number(endMsRaw) / 100) * 100;
    const meta = parseMediaGenerationMeta(generation.meta_json);
    const durationMs = Math.round(
      Number(meta.duration || scene.video_duration || scene.generation_duration || 0) * 1000,
    );
    if (!Number.isInteger(startMs) || !Number.isInteger(endMs) || startMs < 0 || endMs <= startMs) {
      throw new Error('视频截取区间无效');
    }
    if (endMs - startMs < 4000) throw new Error('截取视频不能短于 4 秒');
    if (durationMs <= 0 || endMs > durationMs) throw new Error('视频截取区间超出来源视频时长');
    return { startMs, endMs, durationMs };
  }

  async create(sceneId, generationId, payload) {
    const { scene, generation } = await this.ctx.service.sceneVideoFrame.validateSource(
      sceneId,
      generationId,
    );
    const { startMs, endMs } = this.normalizeRange(
      scene,
      generation,
      payload.start_ms,
      payload.end_ms,
    );
    const filename = `scene-${sceneId}-clip-${generationId}-${startMs}-${endMs}-${Date.now()}.mp4`;
    const sourceReference = normalizeGeneratedAssetReference(this.app, generation.result_url);
    const sourceMeta = parseMediaGenerationMeta(generation.meta_json);
    const stored = await trimVideo(
      this.app,
      generation.result_url,
      startMs / 1000,
      endMs / 1000,
      'scene-videos',
      filename,
    );
    try {
      const clipGeneration = await this.ctx.service.sceneMediaGeneration.create({
        scene_id: sceneId,
        media_type: 'video',
        model: 'video-clip',
        status: 'succeeded',
        result_url: stored.publicPath,
        preview_url: stored.previewPath,
        source_url: sourceReference,
        meta_json: {
          source: 'video-clip',
          source_generation_id: generationId,
          start_ms: startMs,
          end_ms: endMs,
          duration: stored.duration,
          resolution: sourceMeta.resolution,
          aspect_ratio: sourceMeta.aspect_ratio,
          audio: sourceMeta.audio,
        },
      });
      await this.ctx.service.sceneVideoPoster.ensureBestEffort(clipGeneration);
    } catch (error) {
      await deleteGeneratedAsset(this.app, stored.publicPath).catch(() => null);
      throw error;
    }
    return {
      scene: await this.ctx.service.scene.findById(sceneId),
      media_generations: await this.ctx.service.scene.listMediaGenerations(sceneId),
    };
  }
}

module.exports = SceneVideoClipService;
