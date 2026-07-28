'use strict';

const { ApiController } = require('../lib/api_controller');
const response = require('../lib/response');

class ChapterController extends ApiController {

  async indexByProject() {
    const projectId = this.parseId();
    if (!projectId) {
      response.error(this.ctx, 'invalid project id');
      return;
    }

    await this.respond(() => this.ctx.service.chapter.findByProjectId(projectId));
  }

  /**
   * 获取项目下的章节列表。
   * @returns {Promise<void>} 通过统一响应格式返回章节数组。
   * @example
   * GET /api/projects/19/chapters
   * // => { code: 200, data: [{ id: 11, title: "第1章" }], message: "" }
   */
  async show() {
    const id = this.parseId();
    if (!id) {
      response.error(this.ctx, 'invalid id');
      return;
    }

    await this.respond(async () => {
      const chapter = await this.ctx.service.chapter.findById(id);
      if (!chapter) {
        throw new Error('chapter not found');
      }
      return chapter;
    });
  }

  /**
   * 获取单个章节详情。
   * @returns {Promise<void>} 通过统一响应格式返回章节对象。
   * @example
   * GET /api/chapters/11
   * // => { code: 200, data: { id: 11, title: "第1章" }, message: "" }
   */
  async create() {
    const projectId = this.parseId();
    if (!projectId) {
      response.error(this.ctx, 'invalid project id');
      return;
    }

    await this.respond(() =>
      this.ctx.service.chapter.create(projectId, this.ctx.request.body || {}),
    );
  }

  /**
   * 创建章节。
   * @returns {Promise<void>} 通过统一响应格式返回新建章节。
   * @example
   * POST /api/projects/19/chapters { "title": "第2章", "summary": "夜戏开始" }
   * // => { code: 200, data: { id: 12, title: "第2章" }, message: "" }
   */
  async update() {
    const id = this.parseId();
    if (!id) {
      response.error(this.ctx, 'invalid id');
      return;
    }

    await this.respond(() => this.ctx.service.chapter.update(id, this.ctx.request.body || {}));
  }

  /**
   * 更新章节。
   * @returns {Promise<void>} 通过统一响应格式返回更新后的章节。
   * @example
   * PUT /api/chapters/11 { "title": "第1章（修订）" }
   * // => { code: 200, data: { id: 11, title: "第1章（修订）" }, message: "" }
   */
  async destroy() {
    const id = this.parseId();
    if (!id) {
      response.error(this.ctx, 'invalid id');
      return;
    }

    await this.respond(async () => {
      await this.ctx.service.chapter.softDelete(id);
      return { success: true };
    });
  }

  /**
   * 删除章节。
   * @returns {Promise<void>} 通过统一响应格式返回删除结果。
   * @example
   * DELETE /api/chapters/11
   * // => { code: 200, data: { success: true }, message: "" }
   */
}

module.exports = ChapterController;
