'use strict';
// @ts-nocheck

const Service = require('egg').Service;
const { normalizeGeneratedAssetReference, resolveUrl } = require('../lib/generated_asset');
const { downloadAndStore, probeDuration, sanitizeFileName, storeBuffer } = require('../lib/media');
const {
  generateSeedreamImage,
  SEEDREAM_DESIGN_SHEET_SIZE,
  createCharacterVoicePreview,
  generateCharacterVoiceReference,
} = require('../lib/ai_clients');
const { buildCharacterDesignPrompt } = require('../lib/prompt_library');

const CHARACTER_DESIGN_MODEL = 'seedream-4.5';

class CharacterService extends Service {
  get pool() {
    return this.app.mysqlPool;
  }

  /**
   * 把角色数据库行映射成接口对象，并把媒体路径转成可访问 URL。
   * @param {Record<string, unknown>} row 数据库原始行，例如 `{ id: 8, name: "林婉" }`。
   * @returns {object} 映射后的角色对象。
   * @example
   * service.map({ id: 8, project_id: 30, name: "林婉", avatar_url: "/generated/assets/ref.png" })
   * // => { id: 8, project_id: 30, name: "林婉", avatar_url: "https://..." }
   */
  map(row) {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      name: row.name,
      description: row.description || '',
      avatar_url: resolveUrl(
        this.app,
        normalizeGeneratedAssetReference(this.app, row.avatar_url || ''),
        this.app.config.storyboard.publicAppBaseUrl || ''
      ),
      design_sheet_url: resolveUrl(
        this.app,
        normalizeGeneratedAssetReference(this.app, row.design_sheet_url || ''),
        this.app.config.storyboard.publicAppBaseUrl || ''
      ),
      voice_reference_url: resolveUrl(
        this.app,
        normalizeGeneratedAssetReference(this.app, row.voice_reference_url || ''),
        this.app.config.storyboard.publicAppBaseUrl || ''
      ),
      voice_reference_duration: row.voice_reference_duration == null ? 0 : Number(row.voice_reference_duration),
      voice_reference_text: row.voice_reference_text || '',
      voice_name: row.voice_name || '',
      voice_prompt: row.voice_prompt || '',
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
  }

  /**
   * 确认项目存在，避免角色写入无效项目。
   * @param {number} projectId 项目 id，例如 `30`。
   * @returns {Promise<void>} 项目存在时正常返回。
   * @example
   * await service.ensureProjectExists(30)
   * // => void
   */
  async ensureProjectExists(projectId) {
    const [rows] = await this.pool.query('SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL', [projectId]);
    if (!rows.length) throw new Error('project not found');
  }

  /**
   * 读取项目下的全部角色。
   * @param {number} projectId 项目 id，例如 `30`。
   * @returns {Promise<Array>} 角色列表。
   * @example
   * await service.findByProjectId(30)
   * // => [{ id: 8, name: "林婉", design_sheet_url: "https://..." }]
   */
  async findByProjectId(projectId) {
    await this.ensureProjectExists(projectId);
    const [rows] = await this.pool.query(
      `SELECT id, project_id, name, description, avatar_url, design_sheet_url,
              voice_reference_url, voice_reference_duration, voice_reference_text, voice_name, voice_prompt, created_at, updated_at
       FROM characters WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
      [projectId]
    );
    return rows.map(row => this.map(row));
  }

  /**
   * 按 id 读取单个角色。
   * @param {number} id 角色 id，例如 `8`。
   * @returns {Promise<object|null>} 角色对象，不存在时返回 `null`。
   * @example
   * await service.findById(8)
   * // => { id: 8, name: "林婉", avatar_url: "https://..." }
   */
  async findById(id) {
    const [rows] = await this.pool.query(
      `SELECT id, project_id, name, description, avatar_url, design_sheet_url,
              voice_reference_url, voice_reference_duration, voice_reference_text, voice_name, voice_prompt, created_at, updated_at
       FROM characters WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    return rows.length ? this.map(rows[0]) : null;
  }

  /**
   * 创建角色资产记录。
   * @param {number} projectId 项目 id，例如 `30`。
   * @param {Record<string, unknown>} payload 输入数据，例如 `{ name: "林婉", avatar_url: "/generated/assets/ref.png" }`。
   * @returns {Promise<object>} 新建后的角色对象。
   * @example
   * await service.create(30, { name: "林婉", description: "温婉端庄" })
   * // => { id: 8, project_id: 30, name: "林婉" }
   */
  async create(projectId, payload) {
    await this.ensureProjectExists(projectId);
    const name = String(payload.name || '').trim();
    if (!name) throw new Error('name is required');
    const avatarUrl = normalizeGeneratedAssetReference(this.app, String(payload.avatar_url || '').trim());
    const designSheetUrl = normalizeGeneratedAssetReference(this.app, String(payload.design_sheet_url || '').trim());
    const [result] = await this.pool.execute(
      `INSERT INTO characters (
        project_id, name, description, avatar_url, design_sheet_url,
        voice_reference_url, voice_reference_duration, voice_reference_text, voice_name, voice_prompt
      ) VALUES (?, ?, ?, ?, ?, '', NULL, '', '', ?)`,
      [
        projectId,
        name,
        String(payload.description || '').trim(),
        avatarUrl,
        designSheetUrl,
        String(payload.voice_prompt || '').trim(),
      ]
    );
    return await this.findById(result.insertId);
  }

  /**
   * 更新角色文本、参考图和主设定图等字段。
   * @param {number} id 角色 id，例如 `8`。
   * @param {Record<string, unknown>} payload 局部补丁，例如 `{ avatar_url: "/generated/assets/ref.png" }`。
   * @returns {Promise<object>} 更新后的角色对象。
   * @example
   * await service.update(8, { description: "外柔内刚" })
   * // => { id: 8, description: "外柔内刚" }
   */
  async update(id, payload) {
    const current = await this.findById(id);
    if (!current) throw new Error('character not found');
    const name = Object.prototype.hasOwnProperty.call(payload, 'name') ? String(payload.name || '').trim() : current.name;
    if (!name) throw new Error('name is required');

    await this.pool.execute(
      `UPDATE characters
       SET name = ?, description = ?, avatar_url = ?, design_sheet_url = ?, voice_prompt = ?
       WHERE id = ?`,
      [
        name,
        Object.prototype.hasOwnProperty.call(payload, 'description') ? String(payload.description || '').trim() : current.description,
        Object.prototype.hasOwnProperty.call(payload, 'avatar_url')
          ? normalizeGeneratedAssetReference(this.app, String(payload.avatar_url || '').trim())
          : normalizeGeneratedAssetReference(this.app, current.avatar_url),
        Object.prototype.hasOwnProperty.call(payload, 'design_sheet_url')
          ? normalizeGeneratedAssetReference(this.app, String(payload.design_sheet_url || '').trim())
          : normalizeGeneratedAssetReference(this.app, current.design_sheet_url),
        Object.prototype.hasOwnProperty.call(payload, 'voice_prompt') ? String(payload.voice_prompt || '').trim() : current.voice_prompt,
        id,
      ]
    );
    return await this.findById(id);
  }

  /**
   * 软删除角色。
   * @param {number} id 角色 id，例如 `8`。
   * @returns {Promise<void>} 删除标记写入后返回。
   * @example
   * await service.softDelete(8)
   * // => void
   */
  async softDelete(id) {
    await this.pool.execute('UPDATE characters SET deleted_at = NOW() WHERE id = ?', [id]);
  }

  /**
   * 构建角色主设定图的最终 prompt 文本。
   * @param {object} character 角色对象，例如 `{ name: "林婉", description: "温婉端庄" }`。
   * @returns {string} 最终 prompt 文本。
   * @example
   * service.buildDesignPrompt({ name: "林婉", description: "温婉端庄" })
   * // => "..."
   */
  buildDesignPrompt(character) {
    return buildCharacterDesignPrompt(character).prompt;
  }

  /**
   * 收集角色主设定图生成所需的参考图。
   * @param {object} character 角色对象，例如 `{ name: "林婉", avatar_url: "https://..." }`。
   * @returns {{references: Array, missing: Array, avatarUrl: string, layoutUrl: string}} 参考图和缺失项摘要。
   * @example
   * service.collectDesignReferenceImages({ name: "林婉", avatar_url: "https://example.com/ref.png" })
   * // => { references: [{ type: "character-reference", url: "https://example.com/ref.png" }], missing: [] }
   */
  collectDesignReferenceImages(character) {
    const references = [];
    const missing = [];
    const avatarUrl = resolveUrl(this.app, character.avatar_url, this.app.config.storyboard.publicAppBaseUrl || '');
    const layoutUrl = resolveUrl(
      this.app,
      this.app.config.storyboard.characterDesignLayoutReferenceUrl || '',
      this.app.config.storyboard.publicAppBaseUrl || ''
    );

    if (avatarUrl) {
      references.push({
        type: 'character-reference',
        name: `${character.name} 角色参考图`,
        url: avatarUrl,
        source: 'character.avatar_url',
      });
    } else {
      missing.push('character-reference');
    }

    if (layoutUrl) {
      references.push({
        type: 'layout-reference',
        name: '设定板版式参考图',
        url: layoutUrl,
        source: 'storyboard.characterDesignLayoutReferenceUrl',
      });
    }

    return { references, missing, avatarUrl, layoutUrl };
  }

  /**
   * 预览角色主设定图生成参数、参考图和 prompt。
   * @param {number} id 角色 id，例如 `8`。
   * @returns {Promise<object>} 预览信息。
   * @example
   * await service.previewDesignSheetGeneration(8)
   * // => { action: "character-design-sheet", model: "seedream-4.5", final_prompt: "..." }
   */
  async previewDesignSheetGeneration(id) {
    const character = await this.findById(id);
    if (!character) throw new Error('character not found');
    const { references, missing, avatarUrl, layoutUrl } = this.collectDesignReferenceImages(character);
    if (!avatarUrl) {
      throw new Error('生成主设定图前请先上传角色参考图');
    }
    const designPrompt = buildCharacterDesignPrompt(character);
    return {
      action: 'character-design-sheet',
      model: CHARACTER_DESIGN_MODEL,
      reference_images: references,
      fields: {
        角色名称: character.name,
        角色描述: character.description || '-',
        生成模型: 'Seedream 4.5',
        生成方式: '图生图',
        角色参考图: '已提供',
        版式参考图: layoutUrl ? '已配置' : '未配置',
        输出: '角色主设定图',
      },
      template: designPrompt.template,
      prompt_blueprint: designPrompt.blueprint,
      final_prompt: designPrompt.prompt,
      notes: [
        '这次固定走 Seedream 图生图。',
        '角色参考图只用于生成主设定图，不参与其他展示和分镜参考链路。',
        layoutUrl
          ? '系统已附带设定板版式参考图。'
          : '当前未配置系统版式参考图，本次只会基于角色参考图和提示词生成。',
        ...missing.map(item => `缺少参考项：${item}`),
      ],
    };
  }

  /**
   * 预览角色主语音参考生成参数。
   * @param {number} id 角色 id，例如 `8`。
   * @param {string} voicePrompt 自定义声音提示词，例如 `"年轻女性，温柔克制"`。
   * @param {string} previewText 参考台词，例如 `"今晚你先走。"`。
   * @returns {Promise<object>} 语音生成预览信息。
   * @example
   * await service.previewVoiceReferenceGeneration(8, "年轻女性，温柔克制", "今晚你先走。")
   * // => { action: "character-voice-reference", final_prompt: "..." }
   */
  async previewVoiceReferenceGeneration(id, voicePrompt, previewText) {
    const character = await this.findById(id);
    if (!character) throw new Error('character not found');
    const preview = await createCharacterVoicePreview(this.app, character, voicePrompt, previewText);
    return {
      action: 'character-voice-reference',
      model: preview.designModel,
      fields: {
        角色名称: character.name,
        角色描述: character.description,
        目标语音模型: preview.targetModel,
        音色名称: preview.preferredVoiceName,
        参考文本: preview.previewText,
      },
      final_prompt: preview.voicePrompt,
      notes: [ '这段主语音参考会绑定到当前角色，后续对白和视频音频优先参考该声音。' ],
    };
  }

  /**
   * 用 Seedream 图生图生成角色主设定图。
   * @param {number} id 角色 id，例如 `8`。
   * @returns {Promise<object>} 更新后的角色对象，包含 `design_sheet_url`。
   * @example
   * await service.generateDesignSheet(8)
   * // => { id: 8, design_sheet_url: "/generated/characters/character-design-sheet-8-....png" }
   */
  async generateDesignSheet(id) {
    const character = await this.findById(id);
    if (!character) throw new Error('character not found');
    const { avatarUrl, layoutUrl } = this.collectDesignReferenceImages(character);
    if (!avatarUrl) {
      throw new Error('生成主设定图前请先上传角色参考图');
    }
    const prompt = this.buildDesignPrompt(character);
    const imageUrl = await generateSeedreamImage(
      this.app,
      prompt,
      layoutUrl ? [ avatarUrl, layoutUrl ] : [ avatarUrl ],
      { size: SEEDREAM_DESIGN_SHEET_SIZE }
    );
    const filename = `${sanitizeFileName(`character-design-sheet-${id}`)}-${Date.now()}.png`;
    const stored = await downloadAndStore(this.app, imageUrl, 'characters', filename, 'image/png');
    await this.pool.execute('UPDATE characters SET design_sheet_url = ? WHERE id = ?', [ stored.publicPath, id ]);
    return await this.findById(id);
  }

  /**
   * 生成并绑定角色主语音参考音频。
   * @param {number} id 角色 id，例如 `8`。
   * @param {string} voicePrompt 自定义声音提示词，例如 `"年轻女性，温柔克制"`。
   * @param {string} previewText 参考台词，例如 `"今晚你先走。"`。
   * @returns {Promise<object>} 更新后的角色对象，包含语音地址和时长。
   * @example
   * await service.generateVoiceReference(8, "年轻女性，温柔克制", "今晚你先走。")
   * // => { id: 8, voice_reference_url: "/generated/characters/character-voice-reference-8-....wav" }
   */
  async generateVoiceReference(id, voicePrompt, previewText) {
    const character = await this.findById(id);
    if (!character) throw new Error('character not found');
    const result = await generateCharacterVoiceReference(this.app, character, voicePrompt, previewText);
    const filename = `${sanitizeFileName(`character-voice-reference-${id}`)}-${Date.now()}.${result.extension}`;
    const stored = await storeBuffer(this.app, result.audioBuffer, 'characters', filename, 'audio/wav');
    let duration = 0;
    try {
      duration = await probeDuration(stored.localPath);
    } catch {}
    await this.pool.execute(
      `UPDATE characters
       SET voice_reference_url = ?, voice_reference_duration = ?, voice_reference_text = ?, voice_name = ?, voice_prompt = ?
       WHERE id = ?`,
      [ stored.publicPath, duration, result.voiceReferenceText, result.voiceName, result.voicePrompt, id ]
    );
    return await this.findById(id);
  }
}

module.exports = CharacterService;
