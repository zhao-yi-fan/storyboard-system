'use strict';
// @ts-nocheck

const { ApiController } = require('../lib/api_controller');
const response = require('../lib/response');

class AssetController extends ApiController {

  async indexByProject() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid project id');
    await this.respond(() => this.ctx.service.asset.findByProjectId(id));
  }

  /**
   * 获取项目下的资产列表。
   * @returns {Promise<void>} 通过统一响应格式返回资产数组。
   * @example
   * GET /api/projects/30/assets
   * // => { code: 200, data: [{ id: 5, name: "CG背景" }], message: "" }
   */
  async indexByCharacter() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid character id');
    await this.respond(() => this.ctx.service.asset.findByCharacterId(id));
  }

  async show() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    await this.respond(async () => {
      const item = await this.ctx.service.asset.findById(id);
      if (!item) throw new Error('asset not found');
      return item;
    });
  }

  /**
   * 获取角色关联的资产列表。
   * @returns {Promise<void>} 通过统一响应格式返回资产数组。
   * @example
   * GET /api/characters/8/assets
   * // => { code: 200, data: [{ id: 15, character_id: 8, name: "发簪特写" }], message: "" }
   */
  async create() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid project id');
    await this.respond(() => this.ctx.service.asset.create(id, this.ctx.request.body || {}));
  }

  /**
   * 创建资产。
   * @returns {Promise<void>} 通过统一响应格式返回新建资产。
   * @example
   * POST /api/projects/30/assets { "name": "CG背景", "type": "scene" }
   * // => { code: 200, data: { id: 5, name: "CG背景" }, message: "" }
   */
  async update() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    await this.respond(() => this.ctx.service.asset.update(id, this.ctx.request.body || {}));
  }

  /**
   * 更新资产。
   * @returns {Promise<void>} 通过统一响应格式返回更新后的资产。
   * @example
   * PUT /api/assets/5 { "meta": "便利店外景背景" }
   * // => { code: 200, data: { id: 5, meta: "便利店外景背景" }, message: "" }
   */
  async destroy() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    await this.respond(async () => {
      await this.ctx.service.asset.softDelete(id);
      return { success: true };
    });
  }

  /**
   * 删除资产。
   * @returns {Promise<void>} 通过统一响应格式返回删除结果。
   * @example
   * DELETE /api/assets/5
   * // => { code: 200, data: { success: true }, message: "" }
   */
  async previewCoverGeneration() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    await this.respond(() => this.ctx.service.asset.previewCoverGeneration(id));
  }
  /**
   * 预览资产封面生成参数。
   * @returns {Promise<void>} 通过统一响应格式返回字段摘要和 prompt。
   * @example
   * GET /api/assets/5/cover-generation-preview
   * // => { code: 200, data: { action: "asset-cover", final_prompt: "..." }, message: "" }
   */
  async generateCover() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    await this.respond(() => this.ctx.service.asset.generateCover(id));
  }

  /**
   * 生成资产封面。
   * @returns {Promise<void>} 通过统一响应格式返回更新后的资产。
   * @example
   * POST /api/assets/5/generate-cover
   * // => { code: 200, data: { id: 5, cover_url: "/generated/assets/..." }, message: "" }
   */
}

module.exports = AssetController;
