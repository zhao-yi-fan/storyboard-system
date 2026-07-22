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

  async optimizePrompt() {
    const id = this.parseId();
    if (!id) {
      response.error(this.ctx, 'invalid id');
      return;
    }

    try {
      response.success(
        this.ctx,
        await this.ctx.service.scene.optimizePrompt(id, this.ctx.request.body || {}),
      );
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
    try {
      response.success(
        this.ctx,
        await this.ctx.service.scene.previewCoverGeneration(id, this.ctx.query.model),
      );
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async generationReferences() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try {
      response.success(this.ctx, await this.ctx.service.scene.generationReferences(id));
    } catch (err) {
      response.error(this.ctx, err.message);
    }
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
      const scene = await this.ctx.service.scene.generateCover(
        id,
        (this.ctx.request.body || {}).model,
        Boolean((this.ctx.request.body || {}).use_text_only),
      );
      response.success(this.ctx, {
        scene_id: scene.id,
        cover_url: scene.cover_url,
        cover_preview_url: scene.cover_preview_url,
        scene,
      });
    } catch (err) {
      response.error(this.ctx, err.message);
    }
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
    try {
      response.success(this.ctx, await this.ctx.service.scene.generateStoryboardCovers(id));
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  /**
   * 批量生成场景下所有镜头封面。
   * @returns {Promise<void>} 通过统一响应格式返回批量结果。
   * @example
   * POST /api/scenes/21/generate-storyboard-covers
   * // => { code: 200, data: { generated_count: 8, failed: [] }, message: "" }
   */
  async analyzeShotDirections() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try {
      response.success(this.ctx, await this.ctx.service.shotDirection.analyzeScene(id));
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  /**
   * 分析场景下所有镜头的叙事走向。
   * @returns {Promise<void>} 通过统一响应格式返回镜头走向分析列表。
   * @example
   * POST /api/scenes/21/analyze-shot-directions
   * // => { code: 200, data: [{ storyboard_id: 146, status: "succeeded" }], message: "" }
   */
  async shotDirectionAnalyses() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try {
      response.success(this.ctx, await this.ctx.service.shotDirection.listBySceneId(id));
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  /**
   * 获取场景下所有镜头走向分析结果。
   * @returns {Promise<void>} 通过统一响应格式返回镜头走向分析列表。
   * @example
   * GET /api/scenes/21/shot-direction-analyses
   * // => { code: 200, data: [{ storyboard_id: 146, status: "succeeded" }], message: "" }
   */
  async composeVideo() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    const regenerate =
      !Object.prototype.hasOwnProperty.call(this.ctx.request.body || {}, 'regenerate') ||
      Boolean((this.ctx.request.body || {}).regenerate);
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
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async mediaGenerations() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try {
      response.success(this.ctx, await this.ctx.service.scene.listMediaGenerations(id));
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async setMediaGenerationCurrent() {
    const id = this.parseId();
    const generationId = Number(this.ctx.params.generationId);
    if (!id || !Number.isInteger(generationId) || generationId <= 0) {
      return response.error(this.ctx, 'invalid id');
    }
    try {
      response.success(
        this.ctx,
        await this.ctx.service.scene.setMediaGenerationCurrent(id, generationId),
      );
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async deleteMediaGeneration() {
    const id = this.parseId();
    const generationId = Number(this.ctx.params.generationId);
    if (!id || !Number.isInteger(generationId) || generationId <= 0) {
      return response.error(this.ctx, 'invalid id');
    }
    try {
      response.success(
        this.ctx,
        await this.ctx.service.scene.deleteMediaGeneration(id, generationId),
      );
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async videoFrames() {
    const id = this.parseId();
    const generationId = Number(this.ctx.params.generationId);
    if (!id || !Number.isInteger(generationId) || generationId <= 0) {
      return response.error(this.ctx, 'invalid id');
    }
    try {
      await this.ctx.service.sceneVideoFrame.validateSource(id, generationId);
      response.success(
        this.ctx,
        await this.ctx.service.sceneVideoFrame.listByGeneration(id, generationId),
      );
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async createVideoFrame() {
    const id = this.parseId();
    const generationId = Number(this.ctx.params.generationId);
    if (!id || !Number.isInteger(generationId) || generationId <= 0) {
      return response.error(this.ctx, 'invalid id');
    }
    let stream;
    try {
      stream = await this.ctx.getFileStream();
      const chunks = [];
      let size = 0;
      for await (const chunk of stream) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > 10 * 1024 * 1024) throw new Error('抽帧图片不能超过 10MB');
        chunks.push(buffer);
      }
      const fields = stream.fields || {};
      response.success(
        this.ctx,
        await this.ctx.service.sceneVideoFrame.create(id, generationId, {
          buffer: Buffer.concat(chunks),
          content_type: String(stream.mimeType || stream.mime || ''),
          timestamp_ms: fields.timestamp_ms,
          target_scene_id: fields.target_scene_id,
        }),
      );
    } catch (err) {
      if (stream && !stream.readableEnded) stream.resume();
      response.error(this.ctx, err.message);
    }
  }

  async deleteVideoFrame() {
    const id = this.parseId();
    const generationId = Number(this.ctx.params.generationId);
    const frameId = Number(this.ctx.params.frameId);
    if (!id || !Number.isInteger(generationId) || generationId <= 0 || !Number.isInteger(frameId) || frameId <= 0) {
      return response.error(this.ctx, 'invalid id');
    }
    try {
      response.success(
        this.ctx,
        await this.ctx.service.sceneVideoFrame.remove(id, generationId, frameId),
      );
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async createVideoClip() {
    const id = this.parseId();
    const generationId = Number(this.ctx.params.generationId);
    if (!id || !Number.isInteger(generationId) || generationId <= 0) {
      return response.error(this.ctx, 'invalid id');
    }
    try {
      response.success(
        this.ctx,
        await this.ctx.service.sceneVideoClip.create(
          id,
          generationId,
          this.ctx.request.body || {},
        ),
      );
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async previewVideoGeneration() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try {
      response.success(
        this.ctx,
        await this.ctx.service.scene.previewVideoGeneration(
          id,
          this.ctx.query.model,
          this.ctx.query.duration,
          this.ctx.query.use_first_frame,
          this.ctx.query.resolution,
          this.ctx.query.aspect_ratio,
          this.ctx.query.generate_audio,
        ),
      );
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async generateVideo() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    const body = this.ctx.request.body || {};
    try {
      response.success(
        this.ctx,
        await this.ctx.service.scene.generateVideo(
          id,
          body.model,
          body.duration,
          body.use_first_frame,
          body.resolution,
          body.aspect_ratio,
          body.generate_audio,
        ),
      );
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async uploadCover() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try {
      response.success(
        this.ctx,
        await this.ctx.service.scene.uploadCover(id, (this.ctx.request.body || {}).cover_url),
      );
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async addCharacter() {
    const id = this.parseId();
    const characterId = Number((this.ctx.request.body || {}).character_id);
    if (!id || !Number.isInteger(characterId) || characterId <= 0) {
      return response.error(this.ctx, 'invalid id');
    }
    try {
      response.success(this.ctx, await this.ctx.service.scene.addCharacter(id, characterId));
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async removeCharacter() {
    const id = this.parseId();
    const characterId = Number(this.ctx.params.characterId);
    if (!id || !Number.isInteger(characterId) || characterId <= 0) {
      return response.error(this.ctx, 'invalid id');
    }
    try {
      response.success(this.ctx, await this.ctx.service.scene.removeCharacter(id, characterId));
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async addAsset() {
    const id = this.parseId();
    const assetId = Number((this.ctx.request.body || {}).asset_id);
    if (!id || !Number.isInteger(assetId) || assetId <= 0) {
      return response.error(this.ctx, 'invalid id');
    }
    try {
      response.success(this.ctx, await this.ctx.service.scene.addAsset(id, assetId));
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async removeAsset() {
    const id = this.parseId();
    const assetId = Number(this.ctx.params.assetId);
    if (!id || !Number.isInteger(assetId) || assetId <= 0) {
      return response.error(this.ctx, 'invalid id');
    }
    try {
      response.success(this.ctx, await this.ctx.service.scene.removeAsset(id, assetId));
    } catch (err) {
      response.error(this.ctx, err.message);
    }
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
