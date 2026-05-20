'use strict';

const Controller = require('egg').Controller;
const response = require('../lib/response');

class SceneController extends Controller {
  parseId() {
    const id = Number(this.ctx.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return null;
    }
    return id;
  }

  async indexByChapter() {
    const chapterId = this.parseId();
    if (!chapterId) {
      response.error(this.ctx, 'invalid chapter id');
      return;
    }

    try {
      const items = await this.ctx.service.scene.findByChapterId(chapterId);
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
      const scene = await this.ctx.service.scene.findById(id);
      if (!scene) {
        response.error(this.ctx, 'scene not found');
        return;
      }
      response.success(this.ctx, scene);
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async create() {
    const chapterId = this.parseId();
    if (!chapterId) {
      response.error(this.ctx, 'invalid chapter id');
      return;
    }

    try {
      const scene = await this.ctx.service.scene.create(chapterId, this.ctx.request.body || {});
      response.success(this.ctx, scene);
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
      const scene = await this.ctx.service.scene.update(id, this.ctx.request.body || {});
      response.success(this.ctx, scene);
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
      await this.ctx.service.scene.softDelete(id);
      response.success(this.ctx, { success: true });
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async previewCoverGeneration() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try { response.success(this.ctx, await this.ctx.service.scene.previewCoverGeneration(id)); } catch (err) { response.error(this.ctx, err.message); }
  }

  async generateCover() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try {
      const scene = await this.ctx.service.scene.generateCover(id);
      response.success(this.ctx, {
        scene_id: scene.id,
        cover_url: scene.cover_url,
        cover_preview_url: scene.cover_preview_url,
        scene,
      });
    } catch (err) { response.error(this.ctx, err.message); }
  }

  async generateStoryboardCovers() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try { response.success(this.ctx, await this.ctx.service.scene.generateStoryboardCovers(id)); } catch (err) { response.error(this.ctx, err.message); }
  }

  async composeVideo() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    const regenerate = !Object.prototype.hasOwnProperty.call(this.ctx.request.body || {}, 'regenerate') || Boolean((this.ctx.request.body || {}).regenerate);
    try {
      const scene = await this.ctx.service.scene.composeVideo(id, regenerate);
      response.success(this.ctx, {
        scene_id: scene.id,
        video_url: scene.video_url,
        video_preview_url: scene.video_preview_url,
        video_status: scene.video_status,
        video_error: scene.video_error,
        video_duration: scene.video_duration,
        scene,
      });
    } catch (err) { response.error(this.ctx, err.message); }
  }
}

module.exports = SceneController;
