'use strict';
// @ts-nocheck

const Controller = require('egg').Controller;
const response = require('../lib/response');

class AssetController extends Controller {
  parseId() {
    const id = Number(this.ctx.params.id);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  async indexByProject() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid project id');
    try { response.success(this.ctx, await this.ctx.service.asset.findByProjectId(id)); } catch (err) { response.error(this.ctx, err.message); }
  }

  async indexByCharacter() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid character id');
    try { response.success(this.ctx, await this.ctx.service.asset.findByCharacterId(id)); } catch (err) { response.error(this.ctx, err.message); }
  }

  async create() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid project id');
    try { response.success(this.ctx, await this.ctx.service.asset.create(id, this.ctx.request.body || {})); } catch (err) { response.error(this.ctx, err.message); }
  }

  async update() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try { response.success(this.ctx, await this.ctx.service.asset.update(id, this.ctx.request.body || {})); } catch (err) { response.error(this.ctx, err.message); }
  }

  async destroy() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try { await this.ctx.service.asset.softDelete(id); response.success(this.ctx, { success: true }); } catch (err) { response.error(this.ctx, err.message); }
  }

  async previewCoverGeneration() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try { response.success(this.ctx, await this.ctx.service.asset.previewCoverGeneration(id)); } catch (err) { response.error(this.ctx, err.message); }
  }
  async generateCover() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    try { response.success(this.ctx, await this.ctx.service.asset.generateCover(id)); } catch (err) { response.error(this.ctx, err.message); }
  }
}

module.exports = AssetController;
