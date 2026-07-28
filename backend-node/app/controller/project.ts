'use strict';

const { ApiController } = require('../lib/api_controller');
const response = require('../lib/response');

class ProjectController extends ApiController {

  async index() {
    await this.respond(() => this.ctx.service.project.findAll(this.ctx.state.currentUser.id));
  }

  /**
   * 获取项目列表。
   * @returns {Promise<void>} 通过统一响应格式返回项目数组。
   * @example
   * GET /api/projects
   * // => { code: 200, data: [{ id: 19, name: "便利店门口" }], message: "" }
   */
  async show() {
    const id = this.parseId();
    if (!id) {
      response.error(this.ctx, 'invalid id');
      return;
    }

    await this.respond(async () => {
      const project = await this.ctx.service.project.findById(id);
      if (!project) {
        throw new Error('project not found');
      }
      return project;
    });
  }

  /**
   * 获取单个项目详情。
   * @returns {Promise<void>} 通过统一响应格式返回项目对象。
   * @example
   * GET /api/projects/19
   * // => { code: 200, data: { id: 19, name: "便利店门口" }, message: "" }
   */
  async create() {
    const { name = '', description = '' } = this.ctx.request.body || {};
    const trimmedName = String(name).trim();
    if (!trimmedName) {
      response.error(this.ctx, '项目名称不能为空');
      return;
    }

    await this.respond(() =>
      this.ctx.service.project.create(
        { name: trimmedName, description: String(description || '') },
        this.ctx.state.currentUser.id,
      ),
    );
  }

  /**
   * 创建项目。
   * @returns {Promise<void>} 通过统一响应格式返回新建项目。
   * @example
   * POST /api/projects { "name": "新项目", "description": "古风漫剧" }
   * // => { code: 200, data: { id: 30, name: "新项目" }, message: "" }
   */
  async update() {
    const id = this.parseId();
    if (!id) {
      response.error(this.ctx, 'invalid id');
      return;
    }

    await this.respond(() => this.ctx.service.project.update(id, this.ctx.request.body || {}));
  }

  /**
   * 更新项目基础信息。
   * @returns {Promise<void>} 通过统一响应格式返回更新后的项目。
   * @example
   * PUT /api/projects/19 { "description": "修订说明" }
   * // => { code: 200, data: { id: 19, description: "修订说明" }, message: "" }
   */
  async destroy() {
    const id = this.parseId();
    if (!id) {
      response.error(this.ctx, 'invalid id');
      return;
    }

    await this.respond(async () => {
      await this.ctx.service.project.softDelete(id);
      return { success: true };
    });
  }

  /**
   * 软删除项目。
   * @returns {Promise<void>} 通过统一响应格式返回删除结果。
   * @example
   * DELETE /api/projects/19
   * // => { code: 200, data: { success: true }, message: "" }
   */
  async pin() {
    const id = this.parseId();
    if (!id) {
      response.error(this.ctx, 'invalid id');
      return;
    }

    await this.respond(() => this.ctx.service.project.pin(id));
  }

  /**
   * 置顶项目。
   * @returns {Promise<void>} 通过统一响应格式返回置顶后的项目。
   * @example
   * POST /api/projects/19/pin
   * // => { code: 200, data: { id: 19, pinned_at: "..." }, message: "" }
   */
  async unpin() {
    const id = this.parseId();
    if (!id) {
      response.error(this.ctx, 'invalid id');
      return;
    }

    await this.respond(() => this.ctx.service.project.unpin(id));
  }

  /**
   * 取消项目置顶。
   * @returns {Promise<void>} 通过统一响应格式返回取消置顶后的项目。
   * @example
   * POST /api/projects/19/unpin
   * // => { code: 200, data: { id: 19, pinned_at: null }, message: "" }
   */
  async importScript() {
    const id = this.parseId();
    if (!id) {
      response.error(this.ctx, 'invalid id');
      return;
    }
    const { script_text } = this.ctx.request.body || {};
    if (!script_text) {
      response.error(this.ctx, 'script_text is required');
      return;
    }
    await this.respond(() => this.ctx.service.scriptImport.parseAndImport(id, script_text));
  }

  /**
   * 导入小说或剧本文本，并触发结构化拆解。
   * @returns {Promise<void>} 通过统一响应格式返回导入统计结果。
   * @example
   * POST /api/projects/19/import-script { "script_text": "李明推开便利店门。" }
   * // => { code: 200, data: { chapter_count: 1, scene_count: 1, storyboard_count: 3 }, message: "" }
   */
  async composeVideo() {
    const id = this.parseId();
    if (!id) {
      response.error(this.ctx, 'invalid id');
      return;
    }
    const regenerate =
      !Object.prototype.hasOwnProperty.call(this.ctx.request.body || {}, 'regenerate') ||
      Boolean((this.ctx.request.body || {}).regenerate);
    await this.respond(async () => {
      const project = await this.ctx.service.project.composeVideo(id, regenerate);
      return {
        project_id: project.id,
        video_url: project.video_url,
        video_preview_url: project.video_preview_url,
        video_status: project.video_status,
        video_error: project.video_error,
        video_duration: project.video_duration,
        project,
      };
    });
  }

  /**
   * 合成项目总片。
   * @returns {Promise<void>} 通过统一响应格式返回项目视频结果。
   * @example
   * POST /api/projects/19/compose-video { "regenerate": true }
   * // => { code: 200, data: { project_id: 19, video_url: "/generated/project-videos/..." }, message: "" }
   */
}

module.exports = ProjectController;
