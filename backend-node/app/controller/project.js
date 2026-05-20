'use strict';

const Controller = require('egg').Controller;
const response = require('../lib/response');

class ProjectController extends Controller {
  parseId() {
    const id = Number(this.ctx.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return null;
    }
    return id;
  }

  async index() {
    try {
      const projects = await this.ctx.service.project.findAll();
      response.success(this.ctx, projects);
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
      const project = await this.ctx.service.project.findById(id);
      if (!project) {
        response.error(this.ctx, 'project not found');
        return;
      }
      response.success(this.ctx, project);
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async create() {
    const { name = '', description = '' } = this.ctx.request.body || {};
    const trimmedName = String(name).trim();
    if (!trimmedName) {
      response.error(this.ctx, '项目名称不能为空');
      return;
    }

    try {
      const project = await this.ctx.service.project.create({
        name: trimmedName,
        description: String(description || ''),
      });
      response.success(this.ctx, project);
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
      const project = await this.ctx.service.project.update(id, this.ctx.request.body || {});
      response.success(this.ctx, project);
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
      await this.ctx.service.project.softDelete(id);
      response.success(this.ctx, { success: true });
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async pin() {
    const id = this.parseId();
    if (!id) {
      response.error(this.ctx, 'invalid id');
      return;
    }

    try {
      const project = await this.ctx.service.project.pin(id);
      response.success(this.ctx, project);
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async unpin() {
    const id = this.parseId();
    if (!id) {
      response.error(this.ctx, 'invalid id');
      return;
    }

    try {
      const project = await this.ctx.service.project.unpin(id);
      response.success(this.ctx, project);
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

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
    try {
      const result = await this.ctx.service.scriptImport.parseAndImport(id, script_text);
      response.success(this.ctx, result);
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  async composeVideo() {
    const id = this.parseId();
    if (!id) {
      response.error(this.ctx, 'invalid id');
      return;
    }
    const regenerate = !Object.prototype.hasOwnProperty.call(this.ctx.request.body || {}, 'regenerate') || Boolean((this.ctx.request.body || {}).regenerate);
    try {
      const project = await this.ctx.service.project.composeVideo(id, regenerate);
      response.success(this.ctx, {
        project_id: project.id,
        video_url: project.video_url,
        video_preview_url: project.video_preview_url,
        video_status: project.video_status,
        video_error: project.video_error,
        video_duration: project.video_duration,
        project,
      });
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }
}

module.exports = ProjectController;
