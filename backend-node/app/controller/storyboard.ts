'use strict';
// @ts-nocheck

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

  /**
   * 获取场景下的镜头列表。
   * @returns {Promise<void>} 通过统一响应格式返回镜头数组。
   * @example
   * GET /api/scenes/21/storyboards
   * // => { code: 200, data: [{ id: 146, shot_number: 10 }], message: "" }
   */
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

  /**
   * 获取单个镜头详情。
   * @returns {Promise<void>} 通过统一响应格式返回镜头对象。
   * @example
   * GET /api/storyboards/146
   * // => { code: 200, data: { id: 146, content: "李明与林婉对话" }, message: "" }
   */
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

  /**
   * 创建镜头。
   * @returns {Promise<void>} 通过统一响应格式返回新建镜头。
   * @example
   * POST /api/scenes/21/storyboards { "content": "李明与林婉对话" }
   * // => { code: 200, data: { id: 146, content: "李明与林婉对话" }, message: "" }
   */
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

  /**
   * 更新镜头。
   * @returns {Promise<void>} 通过统一响应格式返回更新后的镜头。
   * @example
   * PUT /api/storyboards/146 { "mood": "紧张" }
   * // => { code: 200, data: { id: 146, mood: "紧张" }, message: "" }
   */
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

  /**
   * 删除镜头。
   * @returns {Promise<void>} 通过统一响应格式返回删除结果。
   * @example
   * DELETE /api/storyboards/146
   * // => { code: 200, data: { success: true }, message: "" }
   */
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

  /**
   * 获取镜头的媒体生成历史。
   * @returns {Promise<void>} 通过统一响应格式返回历史记录数组。
   * @example
   * GET /api/storyboards/146/media-generations
   * // => { code: 200, data: [{ id: 29, media_type: "video" }], message: "" }
   */
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

  /**
   * 将某条历史媒体记录设为当前版本。
   * @returns {Promise<void>} 通过统一响应格式返回最新镜头和历史。
   * @example
   * POST /api/storyboards/146/media-generations/29/set-current
   * // => { code: 200, data: { storyboard: { id: 146 }, media_generations: [...] }, message: "" }
   */
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

  /**
   * 删除一条历史媒体记录。
   * @returns {Promise<void>} 通过统一响应格式返回删除后的镜头和历史。
   * @example
   * DELETE /api/storyboards/146/media-generations/29
   * // => { code: 200, data: { storyboard: { id: 146 }, media_generations: [...] }, message: "" }
   */
  async previewCoverGeneration() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try {
      response.success(this.ctx, await this.ctx.service.storyboard.previewCoverGeneration(id, this.ctx.query.model));
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  /**
   * 预览镜头首帧生成参数。
   * @returns {Promise<void>} 通过统一响应格式返回参考图、字段摘要和 prompt。
   * @example
   * GET /api/storyboards/146/cover-generation-preview?model=seedream-4.5
   * // => { code: 200, data: { model: "seedream-4.5", final_prompt: "..." }, message: "" }
   */
  async previewVideoGeneration() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try {
      response.success(this.ctx, await this.ctx.service.storyboard.previewVideoGeneration(id, this.ctx.query.model, this.ctx.query.duration, this.ctx.query.use_first_frame));
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  /**
   * 预览镜头视频生成参数。
   * @returns {Promise<void>} 通过统一响应格式返回视频字段和 prompt。
   * @example
   * GET /api/storyboards/146/video-generation-preview?model=seedance-1.5-pro
   * // => { code: 200, data: { model: "seedance-1.5-pro", final_prompt: "..." }, message: "" }
   */
  async generateCover() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try {
      response.success(this.ctx, await this.ctx.service.storyboard.generateCover(id, (this.ctx.request.body || {}).model, Boolean((this.ctx.request.body || {}).use_text_only)));
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  /**
   * 生成镜头首帧。
   * @returns {Promise<void>} 通过统一响应格式返回更新后的镜头或媒体结果。
   * @example
   * POST /api/storyboards/146/generate-cover { "model": "seedream-4.5" }
   * // => { code: 200, data: { storyboard_id: 146, thumbnail_url: "/generated/storyboards/..." }, message: "" }
   */
  async uploadCover() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try {
      response.success(this.ctx, await this.ctx.service.storyboard.uploadCover(id, (this.ctx.request.body || {}).thumbnail_url));
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  /**
   * 上传并设置镜头当前首帧。
   * @returns {Promise<void>} 通过统一响应格式返回更新后的镜头。
   * @example
   * POST /api/storyboards/146/upload-cover { "thumbnail_url": "/generated/assets/manual.png" }
   * // => { code: 200, data: { id: 146, thumbnail_url: "/generated/assets/manual.png" }, message: "" }
   */
  async generateVideo() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try {
      response.success(this.ctx, await this.ctx.service.storyboard.generateVideo(id, (this.ctx.request.body || {}).model, (this.ctx.request.body || {}).duration, (this.ctx.request.body || {}).use_first_frame));
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  /**
   * 生成镜头视频。
   * @returns {Promise<void>} 通过统一响应格式返回视频任务结果。
   * @example
   * POST /api/storyboards/146/generate-video { "model": "seedance-1.5-pro", "use_first_frame": true }
   * // => { code: 200, data: { storyboard_id: 146, video_url: "/generated/storyboard-videos/..." }, message: "" }
   */
  async addCharacter() {
    const storyboardId = this.parseId();
    const characterId = Number((this.ctx.request.body || {}).character_id);
    if (!storyboardId || !Number.isInteger(characterId) || characterId <= 0) {
      response.error(this.ctx, 'invalid character id');
      return;
    }
    try {
      response.success(this.ctx, await this.ctx.service.storyboard.addCharacter(storyboardId, characterId));
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  /**
   * 给镜头绑定角色。
   * @returns {Promise<void>} 通过统一响应格式返回更新后的镜头。
   * @example
   * POST /api/storyboards/146/characters { "character_id": 8 }
   * // => { code: 200, data: { id: 146, characters: [{ id: 8, name: "林婉" }] }, message: "" }
   */
  async addAsset() {
    const storyboardId = this.parseId();
    const assetId = Number((this.ctx.request.body || {}).asset_id);
    if (!storyboardId || !Number.isInteger(assetId) || assetId <= 0) {
      response.error(this.ctx, 'invalid asset id');
      return;
    }
    try {
      response.success(this.ctx, await this.ctx.service.storyboard.addAsset(storyboardId, assetId));
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  /**
   * 给镜头绑定背景资产。
   * @returns {Promise<void>} 通过统一响应格式返回更新后的镜头。
   * @example
   * POST /api/storyboards/146/assets { "asset_id": 5 }
   * // => { code: 200, data: { id: 146, assets: [{ id: 5, name: "CG背景" }] }, message: "" }
   */
  async removeCharacter() {
    const storyboardId = this.parseId();
    const characterId = Number(this.ctx.params.characterId);
    if (!storyboardId || !Number.isInteger(characterId) || characterId <= 0) {
      response.error(this.ctx, 'invalid character id');
      return;
    }
    try {
      response.success(this.ctx, await this.ctx.service.storyboard.removeCharacter(storyboardId, characterId));
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  /**
   * 从镜头中移除角色。
   * @returns {Promise<void>} 通过统一响应格式返回更新后的镜头。
   * @example
   * DELETE /api/storyboards/146/characters/8
   * // => { code: 200, data: { id: 146, characters: [] }, message: "" }
   */
  async removeAsset() {
    const storyboardId = this.parseId();
    const assetId = Number(this.ctx.params.assetId);
    if (!storyboardId || !Number.isInteger(assetId) || assetId <= 0) {
      response.error(this.ctx, 'invalid asset id');
      return;
    }
    try {
      response.success(this.ctx, await this.ctx.service.storyboard.removeAsset(storyboardId, assetId));
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  /**
   * 从镜头中移除背景资产。
   * @returns {Promise<void>} 通过统一响应格式返回更新后的镜头。
   * @example
   * DELETE /api/storyboards/146/assets/5
   * // => { code: 200, data: { id: 146, assets: [] }, message: "" }
   */
}

module.exports = StoryboardController;
