'use strict';
// @ts-nocheck

const Controller = require('egg').Controller;
const response = require('../lib/response');

class CharacterController extends Controller {
  parseId() {
    const id = Number(this.ctx.params.id);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  async indexByProject() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid project id');
    try { response.success(this.ctx, await this.ctx.service.character.findByProjectId(id)); } catch (err) { response.error(this.ctx, err.message); }
  }

  async show() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try {
      const item = await this.ctx.service.character.findById(id);
      if (!item) return response.error(this.ctx, 'character not found');
      response.success(this.ctx, item);
    } catch (err) { response.error(this.ctx, err.message); }
  }

  async create() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid project id');
    try { response.success(this.ctx, await this.ctx.service.character.create(id, this.ctx.request.body || {})); } catch (err) { response.error(this.ctx, err.message); }
  }

  async update() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try { response.success(this.ctx, await this.ctx.service.character.update(id, this.ctx.request.body || {})); } catch (err) { response.error(this.ctx, err.message); }
  }

  async destroy() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try { await this.ctx.service.character.softDelete(id); response.success(this.ctx, { success: true }); } catch (err) { response.error(this.ctx, err.message); }
  }

  async previewDesignSheetGeneration() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try { response.success(this.ctx, await this.ctx.service.character.previewDesignSheetGeneration(id, this.ctx.query.model, this.ctx.query.mode)); } catch (err) { response.error(this.ctx, err.message); }
  }
  async previewVoiceReferenceGeneration() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try { response.success(this.ctx, await this.ctx.service.character.previewVoiceReferenceGeneration(id, this.ctx.query.voice_prompt, this.ctx.query.preview_text)); } catch (err) { response.error(this.ctx, err.message); }
  }
  async generateDesignSheet() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    const body = this.ctx.request.body || {};
    try { response.success(this.ctx, await this.ctx.service.character.generateDesignSheet(id, body.model, body.mode)); } catch (err) { response.error(this.ctx, err.message); }
  }
  async generateVoiceReference() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    const body = this.ctx.request.body || {};
    try { response.success(this.ctx, await this.ctx.service.character.generateVoiceReference(id, body.voice_prompt, body.preview_text)); } catch (err) { response.error(this.ctx, err.message); }
  }
}

module.exports = CharacterController;
