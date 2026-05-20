'use strict';

const Controller = require('egg').Controller;
const response = require('../lib/response');

class StoryboardController extends Controller {
  parseId() {
    const id = Number(this.ctx.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return null;
    }
    return id;
  }

  async indexByScene() {
    const sceneId = this.parseId();
    if (!sceneId) {
      response.error(this.ctx, 'invalid scene id');
      return;
    }

    try {
      const items = await this.ctx.service.storyboard.findBySceneId(sceneId);
      response.success(this.ctx, items);
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async show() {
    const id = this.parseId();
    if (!id) {
      response.error(this.ctx, 'invalid id');
      return;
    }

    try {
      const storyboard = await this.ctx.service.storyboard.findById(id);
      if (!storyboard) {
        response.error(this.ctx, 'storyboard not found');
        return;
      }
      response.success(this.ctx, storyboard);
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async create() {
    const sceneId = this.parseId();
    if (!sceneId) {
      response.error(this.ctx, 'invalid scene id');
      return;
    }

    try {
      const storyboard = await this.ctx.service.storyboard.create(sceneId, this.ctx.request.body || {});
      response.success(this.ctx, storyboard);
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async update() {
    const id = this.parseId();
    if (!id) {
      response.error(this.ctx, 'invalid id');
      return;
    }

    try {
      const storyboard = await this.ctx.service.storyboard.update(id, this.ctx.request.body || {});
      response.success(this.ctx, storyboard);
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async destroy() {
    const id = this.parseId();
    if (!id) {
      response.error(this.ctx, 'invalid id');
      return;
    }

    try {
      await this.ctx.service.storyboard.softDelete(id);
      response.success(this.ctx, { success: true });
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async mediaGenerations() {
    const id = this.parseId();
    if (!id) {
      response.error(this.ctx, 'invalid id');
      return;
    }
    try {
      response.success(this.ctx, await this.ctx.service.mediaGeneration.listByStoryboardId(id));
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async setMediaGenerationCurrent() {
    const storyboardId = this.parseId();
    const generationId = Number(this.ctx.params.generationId);
    if (!storyboardId || !Number.isInteger(generationId) || generationId <= 0) {
      response.error(this.ctx, 'invalid generation id');
      return;
    }
    try {
      const generation = await this.ctx.service.mediaGeneration.findById(generationId);
      if (!generation || generation.storyboard_id !== storyboardId) {
        response.error(this.ctx, 'media generation not found');
        return;
      }
      if (generation.status !== 'succeeded') {
        response.error(this.ctx, 'only succeeded history can be set as current');
        return;
      }
      await this.ctx.service.mediaGeneration.markCurrent(storyboardId, generation.media_type, generationId);
      const storyboard = await this.ctx.service.storyboard.applyMediaGeneration(storyboardId, generation);
      response.success(this.ctx, {
        storyboard,
        media_generations: await this.ctx.service.mediaGeneration.listByStoryboardId(storyboardId),
      });
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async deleteMediaGeneration() {
    const storyboardId = this.parseId();
    const generationId = Number(this.ctx.params.generationId);
    if (!storyboardId || !Number.isInteger(generationId) || generationId <= 0) {
      response.error(this.ctx, 'invalid generation id');
      return;
    }
    try {
      const generation = await this.ctx.service.mediaGeneration.findById(generationId);
      if (!generation || generation.storyboard_id !== storyboardId) {
        response.error(this.ctx, 'media generation not found');
        return;
      }
      if (generation.status === 'generating') {
        response.error(this.ctx, 'generating history cannot be deleted');
        return;
      }
      await this.ctx.service.mediaGeneration.softDelete(generationId);
      let storyboard;
      if (generation.is_current) {
        const fallback = await this.ctx.service.mediaGeneration.findLatestSucceeded(storyboardId, generation.media_type, generationId);
        if (fallback) {
          await this.ctx.service.mediaGeneration.markCurrent(storyboardId, generation.media_type, fallback.id);
          storyboard = await this.ctx.service.storyboard.applyMediaGeneration(storyboardId, fallback);
        } else {
          storyboard = await this.ctx.service.storyboard.clearMedia(storyboardId, generation.media_type);
        }
      } else {
        storyboard = await this.ctx.service.storyboard.findById(storyboardId);
      }
      response.success(this.ctx, {
        storyboard,
        media_generations: await this.ctx.service.mediaGeneration.listByStoryboardId(storyboardId),
      });
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async previewCoverGeneration() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try {
      response.success(this.ctx, await this.ctx.service.storyboard.previewCoverGeneration(id, this.ctx.query.model));
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async previewVideoGeneration() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try {
      response.success(this.ctx, await this.ctx.service.storyboard.previewVideoGeneration(id, this.ctx.query.model, this.ctx.query.duration));
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async generateCover() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try {
      response.success(this.ctx, await this.ctx.service.storyboard.generateCover(id, (this.ctx.request.body || {}).model, Boolean((this.ctx.request.body || {}).use_text_only)));
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async generateVideo() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try {
      response.success(this.ctx, await this.ctx.service.storyboard.generateVideo(id, (this.ctx.request.body || {}).model, (this.ctx.request.body || {}).duration));
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }
}

module.exports = StoryboardController;
