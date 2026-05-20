'use strict';
// @ts-nocheck

const Controller = require('egg').Controller;
const response = require('../lib/response');

class ChapterController extends Controller {
  parseId() {
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
      const chapter = await this.ctx.service.chapter.findById(id);
      if (!chapter) {
        response.error(this.ctx, 'chapter not found');
        return;
      }
      response.success(this.ctx, chapter);
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async create() {
    const projectId = this.parseId();
    if (!projectId) {
      response.error(this.ctx, 'invalid project id');
      return;
    }

    try {
      const chapter = await this.ctx.service.chapter.create(projectId, this.ctx.request.body || {});
      response.success(this.ctx, chapter);
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
      const chapter = await this.ctx.service.chapter.update(id, this.ctx.request.body || {});
      response.success(this.ctx, chapter);
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
      await this.ctx.service.chapter.softDelete(id);
      response.success(this.ctx, { success: true });
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }
}

module.exports = ChapterController;
