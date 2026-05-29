'use strict';
// @ts-nocheck

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

  /**
   * 获取章节下的场景列表。
   * @returns {Promise<void>} 通过统一响应格式返回场景数组。
   * @example
   * GET /api/chapters/11/scenes
   * // => { code: 200, data: [{ id: 21, title: "便利店门口" }], message: "" }
   */
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

  /**
   * 获取单个场景详情。
   * @returns {Promise<void>} 通过统一响应格式返回场景对象。
   * @example
   * GET /api/scenes/21
   * // => { code: 200, data: { id: 21, title: "便利店门口" }, message: "" }
   */
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

  /**
   * 创建场景。
   * @returns {Promise<void>} 通过统一响应格式返回新建场景。
   * @example
   * POST /api/chapters/11/scenes { "title": "便利店门口" }
   * // => { code: 200, data: { id: 21, title: "便利店门口" }, message: "" }
   */
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

  /**
   * 更新场景。
   * @returns {Promise<void>} 通过统一响应格式返回更新后的场景。
   * @example
   * PUT /api/scenes/21 { "style_notes": "冷光湿地面" }
   * // => { code: 200, data: { id: 21, style_notes: "冷光湿地面" }, message: "" }
   */
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

  /**
   * 删除场景。
   * @returns {Promise<void>} 通过统一响应格式返回删除结果。
   * @example
   * DELETE /api/scenes/21
   * // => { code: 200, data: { success: true }, message: "" }
   */
  async previewCoverGeneration() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try { response.success(this.ctx, await this.ctx.service.scene.previewCoverGeneration(id)); } catch (err) { response.error(this.ctx, err.message); }
  }

  /**
   * 预览场景封面生成参数。
   * @returns {Promise<void>} 通过统一响应格式返回字段摘要和 prompt。
   * @example
   * GET /api/scenes/21/cover-generation-preview
   * // => { code: 200, data: { action: "scene-cover", final_prompt: "..." }, message: "" }
   */
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

  /**
   * 生成场景封面。
   * @returns {Promise<void>} 通过统一响应格式返回更新后的场景。
   * @example
   * POST /api/scenes/21/generate-cover
   * // => { code: 200, data: { scene_id: 21, cover_url: "/generated/scene-covers/..." }, message: "" }
   */
  async generateStoryboardCovers() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try { response.success(this.ctx, await this.ctx.service.scene.generateStoryboardCovers(id)); } catch (err) { response.error(this.ctx, err.message); }
  }

  /**
   * 批量生成场景下所有镜头封面。
   * @returns {Promise<void>} 通过统一响应格式返回批量结果。
   * @example
   * POST /api/scenes/21/generate-storyboard-covers
   * // => { code: 200, data: { generated_count: 8, failed: [] }, message: "" }
   */
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

  /**
   * 合成场景视频。
   * @returns {Promise<void>} 通过统一响应格式返回场景视频结果。
   * @example
   * POST /api/scenes/21/compose-video { "regenerate": true }
   * // => { code: 200, data: { scene_id: 21, video_url: "/generated/scene-videos/..." }, message: "" }
   */
}

module.exports = SceneController;
