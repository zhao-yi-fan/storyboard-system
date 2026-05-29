'use strict';

const Controller = require('egg').Controller;
const response = require('../lib/response');

class ChapterController extends Controller {
  parseId(): number | null {
    const id = Number(this.ctx.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return null;
    }
    return id;
  }

  async indexByProject() {
    const projectId = this.parseId();
    if (!projectId) {
      response.error(this.ctx, 'invalid project id');
      return;
    }

    try {
      const items = await this.ctx.service.chapter.findByProjectId(projectId);
      response.success(this.ctx, items);
    } catch (err: any) {
      response.error(this.ctx, err.message);
    }
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

    try {
      const chapter = await this.ctx.service.chapter.findById(id);
      if (!chapter) {
        response.error(this.ctx, 'chapter not found');
        return;
      }
      response.success(this.ctx, chapter);
    } catch (err: any) {
      response.error(this.ctx, err.message);
    }
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

    try {
      const chapter = await this.ctx.service.chapter.create(projectId, this.ctx.request.body || {});
      response.success(this.ctx, chapter);
    } catch (err: any) {
      response.error(this.ctx, err.message);
    }
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

    try {
      const chapter = await this.ctx.service.chapter.update(id, this.ctx.request.body || {});
      response.success(this.ctx, chapter);
    } catch (err: any) {
      response.error(this.ctx, err.message);
    }
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

    try {
      await this.ctx.service.chapter.softDelete(id);
      response.success(this.ctx, { success: true });
    } catch (err: any) {
      response.error(this.ctx, err.message);
    }
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
