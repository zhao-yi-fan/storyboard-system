'use strict';
// @ts-nocheck

const { ApiController } = require('../lib/api_controller');
const response = require('../lib/response');

class CharacterController extends ApiController {

  async indexByProject() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid project id');
    await this.respond(() => this.ctx.service.character.findByProjectId(id));
  }

  /**
   * 获取项目下的角色列表。
   * @returns {Promise<void>} 通过统一响应格式返回角色数组。
   * @example
   * GET /api/projects/30/characters
   * // => { code: 200, data: [{ id: 8, name: "林婉" }], message: "" }
   */
  async show() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    await this.respond(async () => {
      const item = await this.ctx.service.character.findById(id);
      if (!item) throw new Error('character not found');
      return item;
    });
  }

  /**
   * 获取单个角色详情。
   * @returns {Promise<void>} 通过统一响应格式返回角色对象。
   * @example
   * GET /api/characters/8
   * // => { code: 200, data: { id: 8, name: "林婉" }, message: "" }
   */
  async create() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid project id');
    await this.respond(() => this.ctx.service.character.create(id, this.ctx.request.body || {}));
  }

  /**
   * 创建角色。
   * @returns {Promise<void>} 通过统一响应格式返回新建角色。
   * @example
   * POST /api/projects/30/characters { "name": "林婉", "description": "温婉端庄" }
   * // => { code: 200, data: { id: 8, name: "林婉" }, message: "" }
   */
  async update() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    await this.respond(() => this.ctx.service.character.update(id, this.ctx.request.body || {}));
  }

  /**
   * 更新角色。
   * @returns {Promise<void>} 通过统一响应格式返回更新后的角色。
   * @example
   * PUT /api/characters/8 { "avatar_url": "/generated/assets/ref.png" }
   * // => { code: 200, data: { id: 8, avatar_url: "https://..." }, message: "" }
   */
  async destroy() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    await this.respond(async () => {
      await this.ctx.service.character.softDelete(id);
      return { success: true };
    });
  }

  /**
   * 删除角色。
   * @returns {Promise<void>} 通过统一响应格式返回删除结果。
   * @example
   * DELETE /api/characters/8
   * // => { code: 200, data: { success: true }, message: "" }
   */
  async previewDesignSheetGeneration() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    await this.respond(() =>
      this.ctx.service.character.previewDesignSheetGeneration(
        id,
        this.ctx.query.model,
        this.ctx.query.mode,
      ),
    );
  }
  /**
   * 预览角色主设定图生成参数。
   * @returns {Promise<void>} 通过统一响应格式返回参考图、字段摘要和 prompt。
   * @example
   * GET /api/characters/8/design-sheet-generation-preview
   * // => { code: 200, data: { model: "seedream-4.5", final_prompt: "..." }, message: "" }
   */
  async previewVoiceReferenceGeneration() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    await this.respond(() =>
      this.ctx.service.character.previewVoiceReferenceGeneration(
        id,
        this.ctx.query.voice_prompt,
        this.ctx.query.preview_text,
      ),
    );
  }
  /**
   * 预览角色主语音参考生成参数。
   * @returns {Promise<void>} 通过统一响应格式返回语音 prompt 预览。
   * @example
   * GET /api/characters/8/voice-reference-generation-preview?voice_prompt=温柔
   * // => { code: 200, data: { action: "character-voice-reference", final_prompt: "..." }, message: "" }
   */
  async generateDesignSheet() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    const body = this.ctx.request.body || {};
    await this.respond(() =>
      this.ctx.service.character.generateDesignSheet(id, body.prompt_override),
    );
  }
  /**
   * 生成角色主设定图。
   * @returns {Promise<void>} 通过统一响应格式返回更新后的角色对象。
   * @example
   * POST /api/characters/8/generate-design-sheet
   * // => { code: 200, data: { id: 8, design_sheet_url: "/generated/characters/..." }, message: "" }
   */
  async generateVoiceReference() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    const body = this.ctx.request.body || {};
    await this.respond(() =>
      this.ctx.service.character.generateVoiceReference(
        id,
        body.voice_prompt,
        body.preview_text,
      ),
    );
  }

  async uploadVoiceReference() {
    const id = this.parseId();
    if (!id) return response.error(this.ctx, 'invalid id');
    const body = this.ctx.request.body || {};
    await this.respond(() =>
      this.ctx.service.character.uploadVoiceReference(id, body.voice_reference_url),
    );
  }

  /**
   * 生成角色主语音参考。
   * @returns {Promise<void>} 通过统一响应格式返回更新后的角色对象。
   * @example
   * POST /api/characters/8/generate-voice-reference { "voice_prompt": "年轻女性，温柔克制" }
   * // => { code: 200, data: { id: 8, voice_reference_url: "/generated/characters/..." }, message: "" }
   */
}

module.exports = CharacterController;
