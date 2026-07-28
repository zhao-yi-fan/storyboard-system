'use strict';
// @ts-nocheck

const Service = require('egg').Service;
const { GENERATION_STATUS, MEDIA_TYPE } = require('../lib/domain_constants');
const path = require('node:path');
const {
  createPreviewFromLocalPath,
  createPreviewFromSource,
  videoPosterSpec,
} = require('../lib/media');

class SceneVideoPosterService extends Service {
  buildFilename(sceneId, generationId) {
    return `scene-${Number(sceneId)}-video-${Number(generationId)}-poster.webp`;
  }

  async extractFromLocalPath(sceneId, generationId, localPath) {
    const posterUrl = await createPreviewFromLocalPath(
      this.app,
      localPath,
      'scene-video-posters',
      this.buildFilename(sceneId, generationId),
      videoPosterSpec(),
    );
    await this.ctx.service.sceneMediaGeneration.update(generationId, {
      poster_url: posterUrl,
    });
    return posterUrl;
  }

  async ensureForGeneration(generation, localPath = '') {
    if (!generation || generation.media_type !== MEDIA_TYPE.VIDEO) {
      throw new Error('video generation is required');
    }
    if (generation.status !== GENERATION_STATUS.SUCCEEDED || !generation.result_url) {
      throw new Error('only succeeded video media can create a poster');
    }
    if (generation.poster_url) return generation.poster_url;

    const posterUrl = localPath
      ? await this.extractFromLocalPath(generation.scene_id, generation.id, localPath)
      : await createPreviewFromSource(
          this.app,
          generation.result_url,
          'scene-video-posters',
          path.basename(this.buildFilename(generation.scene_id, generation.id), '.webp'),
          videoPosterSpec(),
        );
    if (!localPath) {
      await this.ctx.service.sceneMediaGeneration.update(generation.id, {
        poster_url: posterUrl,
      });
    }
    return posterUrl;
  }

  async ensureBestEffort(generation, localPath = '') {
    try {
      return await this.ensureForGeneration(generation, localPath);
    } catch (error) {
      this.ctx.logger.warn(
        '[video-poster] scene=%s generation=%s extraction failed: %s',
        generation?.scene_id || '',
        generation?.id || '',
        error?.message || error,
      );
      return '';
    }
  }
}

module.exports = SceneVideoPosterService;
