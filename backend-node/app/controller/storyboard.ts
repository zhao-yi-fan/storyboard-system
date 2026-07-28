'use strict';
// @ts-nocheck

const { ApiController } = require('../lib/api_controller');
const response = require('../lib/response');

class StoryboardController extends ApiController {

  async indexByScene() {
    const sceneId = this.parseId();
    if (!sceneId) {
      response.error(this.ctx, 'invalid scene id');
      return;
    }

    await this.respond(() => this.ctx.service.storyboard.findBySceneId(sceneId));
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

    await this.respond(async () => {
      const storyboard = await this.ctx.service.storyboard.findById(id);
      if (!storyboard) {
        throw new Error('storyboard not found');
      }
      return storyboard;
    });
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

    await this.respond(() =>
      this.ctx.service.storyboard.create(sceneId, this.ctx.request.body || {}),
    );
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

    await this.respond(() =>
      this.ctx.service.storyboard.update(id, this.ctx.request.body || {}),
    );
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

    await this.respond(async () => {
      await this.ctx.service.storyboard.softDelete(id);
      return { success: true };
    });
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
    await this.respond(() => this.ctx.service.mediaGeneration.listByStoryboardId(id));
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
    await this.respond(async () => {
      const generation = await this.ctx.service.mediaGeneration.findById(generationId);
      if (!generation || generation.storyboard_id !== storyboardId) {
        throw new Error('media generation not found');
      }
      if (generation.status !== 'succeeded') {
        throw new Error('only succeeded history can be set as current');
      }
      await this.ctx.service.mediaGeneration.markCurrent(
        storyboardId,
        generation.media_type,
        generationId,
      );
      const storyboard = await this.ctx.service.storyboard.applyMediaGeneration(
        storyboardId,
        generation,
      );
      return {
        storyboard,
        media_generations: await this.ctx.service.mediaGeneration.listByStoryboardId(storyboardId),
      };
    });
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
    await this.respond(async () => {
      const generation = await this.ctx.service.mediaGeneration.findById(generationId);
      if (!generation || generation.storyboard_id !== storyboardId) {
        throw new Error('media generation not found');
      }
      if (generation.status === 'generating') {
        throw new Error('generating history cannot be deleted');
      }
      await this.ctx.service.mediaGeneration.softDelete(generationId);
      let storyboard;
      if (generation.is_current) {
        const fallback = await this.ctx.service.mediaGeneration.findLatestSucceeded(
          storyboardId,
          generation.media_type,
          generationId,
        );
        if (fallback) {
          await this.ctx.service.mediaGeneration.markCurrent(
            storyboardId,
            generation.media_type,
            fallback.id,
          );
          storyboard = await this.ctx.service.storyboard.applyMediaGeneration(
            storyboardId,
            fallback,
          );
        } else {
          storyboard = await this.ctx.service.storyboard.clearMedia(
            storyboardId,
            generation.media_type,
          );
        }
      } else {
        storyboard = await this.ctx.service.storyboard.findById(storyboardId);
      }
      return {
        storyboard,
        media_generations: await this.ctx.service.mediaGeneration.listByStoryboardId(storyboardId),
      };
    });
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
    await this.respond(() =>
      this.ctx.service.storyboard.previewCoverGeneration(id, this.ctx.query.model),
    );
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
    await this.respond(() =>
      this.ctx.service.storyboard.previewVideoGeneration(
        id,
        this.ctx.query.model,
        this.ctx.query.duration,
        this.ctx.query.use_first_frame,
        this.ctx.query.resolution,
        this.ctx.query.generate_audio,
      ),
    );
  }

  /**
   * 预览镜头视频生成参数。
   * @returns {Promise<void>} 通过统一响应格式返回视频字段和 prompt。
   * @example
   * GET /api/storyboards/146/video-generation-preview?model=seedance-2.0
   * // => { code: 200, data: { model: "seedance-2.0", final_prompt: "..." }, message: "" }
   */
  async generateCover() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    await this.respond(() =>
      this.ctx.service.storyboard.generateCover(
        id,
        (this.ctx.request.body || {}).model,
        Boolean((this.ctx.request.body || {}).use_text_only),
      ),
    );
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
    await this.respond(() =>
      this.ctx.service.storyboard.uploadCover(
        id,
        (this.ctx.request.body || {}).thumbnail_url,
      ),
    );
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
    await this.respond(() =>
      this.ctx.service.storyboard.generateVideo(
        id,
        (this.ctx.request.body || {}).model,
        (this.ctx.request.body || {}).duration,
        (this.ctx.request.body || {}).use_first_frame,
        (this.ctx.request.body || {}).resolution,
        (this.ctx.request.body || {}).generate_audio,
      ),
    );
  }

  /**
   * 生成镜头视频。
   * @returns {Promise<void>} 通过统一响应格式返回视频任务结果。
   * @example
   * POST /api/storyboards/146/generate-video { "model": "seedance-2.0", "use_first_frame": true }
   * // => { code: 200, data: { storyboard_id: 146, video_url: "/generated/storyboard-videos/..." }, message: "" }
   */
  async applyShotDirectionSuggestion() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    await this.respond(() =>
      this.ctx.service.shotDirection.applySuggestion(id, this.ctx.request.body || {}),
    );
  }

  /**
   * 将最新镜头走向分析建议写入镜头现有字段。
   * @returns {Promise<void>} 通过统一响应格式返回更新后的镜头。
   * @example
   * POST /api/storyboards/146/apply-shot-direction-suggestion
   * // => { code: 200, data: { id: 146, camera_motion: "缓慢推进" }, message: "" }
   */
  async addCharacter() {
    const storyboardId = this.parseId();
    const characterId = Number((this.ctx.request.body || {}).character_id);
    if (!storyboardId || !Number.isInteger(characterId) || characterId <= 0) {
      response.error(this.ctx, 'invalid character id');
      return;
    }
    await this.respond(() =>
      this.ctx.service.storyboard.addCharacter(storyboardId, characterId),
    );
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
    await this.respond(() => this.ctx.service.storyboard.addAsset(storyboardId, assetId));
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
    await this.respond(() =>
      this.ctx.service.storyboard.removeCharacter(storyboardId, characterId),
    );
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
    await this.respond(() => this.ctx.service.storyboard.removeAsset(storyboardId, assetId));
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
