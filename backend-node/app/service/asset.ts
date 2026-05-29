'use strict';
// @ts-nocheck

const Service = require('egg').Service;
const path = require('node:path');
const { createPreviewFromSource, assetPreviewSpec, downloadAndStore, createPreviewFromLocalPath, sanitizeFileName } = require('../lib/media');
const { normalizeGeneratedAssetReference, resolveUrl } = require('../lib/generated_asset');
const { buildAssetCoverPrompt } = require('../lib/prompt_library');

class AssetService extends Service {
  get pool() {
    return this.app.mysqlPool;
  }

  /**
   * 把资产数据库行映射成接口对象，并补全可访问 URL。
   * @param {Record<string, unknown>} row 数据库原始行，例如 `{ id: 5, type: "scene" }`。
   * @returns {object} 映射后的资产对象。
   * @example
   * service.map({ id: 5, project_id: 30, name: "CG背景", type: "scene", file_url: "/generated/assets/a.png" })
   * // => { id: 5, project_id: 30, name: "CG背景", type: "scene", file_url: "https://..." }
   */
  map(row) {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      character_id: row.character_id == null ? undefined : Number(row.character_id),
      name: row.name,
      type: row.type,
      file_url: resolveUrl(this.app, row.file_url || '', this.app.config.storyboard.publicAppBaseUrl || ''),
      cover_url: resolveUrl(this.app, row.cover_url || '', this.app.config.storyboard.publicAppBaseUrl || ''),
      thumbnail_url: resolveUrl(this.app, row.thumbnail_url || '', this.app.config.storyboard.publicAppBaseUrl || ''),
      meta: row.meta || '',
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
  }

  /**
   * 确认项目存在，避免把资产挂到无效项目上。
   * @param {number} projectId 项目 id，例如 `30`。
   * @returns {Promise<void>} 项目存在时正常返回。
   * @example
   * await service.ensureProjectExists(30)
   * // => void
   */
  async ensureProjectExists(projectId) {
    const [ rows ] = await this.pool.query('SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL', [ projectId ]);
    if (!rows.length) throw new Error('project not found');
  }

  /**
   * 确认角色属于当前项目，供角色关联资产使用。
   * @param {number} characterId 角色 id，例如 `8`。
   * @param {number} projectId 项目 id，例如 `30`。
   * @returns {Promise<void>} 角色合法时正常返回。
   * @example
   * await service.ensureCharacterInProject(8, 30)
   * // => void
   */
  async ensureCharacterInProject(characterId, projectId) {
    const [ rows ] = await this.pool.query(
      'SELECT id FROM characters WHERE id = ? AND project_id = ? AND deleted_at IS NULL',
      [ characterId, projectId ]
    );
    if (!rows.length) throw new Error('character not found');
  }

  /**
   * 读取项目下的全部资产。
   * @param {number} projectId 项目 id，例如 `30`。
   * @returns {Promise<Array>} 资产列表。
   * @example
   * await service.findByProjectId(30)
   * // => [{ id: 5, name: "CG背景", type: "scene" }]
   */
  async findByProjectId(projectId) {
    await this.ensureProjectExists(projectId);
    const [ rows ] = await this.pool.query(
      `SELECT id, project_id, character_id, name, type, file_url, cover_url, thumbnail_url, meta, created_at, updated_at
       FROM assets WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
      [ projectId ]
    );
    const items = rows.map(row => this.map(row));
    for (const item of items) {
      await this.ensurePreview(item);
    }
    return items;
  }

  /**
   * 读取某个角色绑定的全部资产。
   * @param {number} characterId 角色 id，例如 `8`。
   * @returns {Promise<Array>} 资产列表。
   * @example
   * await service.findByCharacterId(8)
   * // => [{ id: 15, character_id: 8, name: "发簪特写", type: "prop" }]
   */
  async findByCharacterId(characterId) {
    const [ rows ] = await this.pool.query(
      `SELECT id, project_id, character_id, name, type, file_url, cover_url, thumbnail_url, meta, created_at, updated_at
       FROM assets WHERE character_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
      [ characterId ]
    );
    const items = rows.map(row => this.map(row));
    for (const item of items) {
      await this.ensurePreview(item);
    }
    return items;
  }

  /**
   * 按 id 读取单个资产。
   * @param {number} id 资产 id，例如 `5`。
   * @returns {Promise<object|null>} 资产对象，不存在时返回 `null`。
   * @example
   * await service.findById(5)
   * // => { id: 5, name: "CG背景", file_url: "https://..." }
   */
  async findById(id) {
    const [ rows ] = await this.pool.query(
      `SELECT id, project_id, character_id, name, type, file_url, cover_url, thumbnail_url, meta, created_at, updated_at
       FROM assets WHERE id = ? AND deleted_at IS NULL`,
      [ id ]
    );
    if (!rows.length) {
      return null;
    }
    const item = this.map(rows[0]);
    await this.ensurePreview(item);
    return item;
  }

  /**
   * 创建场景资产或角色资产。
   * @param {number} projectId 项目 id，例如 `30`。
   * @param {Record<string, unknown>} payload 输入数据，例如 `{ name: "CG背景", type: "scene", file_url: "/generated/assets/a.png" }`。
   * @returns {Promise<object>} 新建后的资产对象。
   * @example
   * await service.create(30, { name: "CG背景", type: "scene", file_url: "/generated/assets/a.png" })
   * // => { id: 5, project_id: 30, name: "CG背景", type: "scene" }
   */
  async create(projectId, payload) {
    await this.ensureProjectExists(projectId);
    const name = String(payload.name || '').trim();
    const type = String(payload.type || '').trim();
    if (!name) throw new Error('name is required');
    if (!type) throw new Error('type is required');
    const characterId = payload.character_id == null ? null : Number(payload.character_id);
    if (characterId) await this.ensureCharacterInProject(characterId, projectId);
    const [ result ] = await this.pool.execute(
      `INSERT INTO assets (project_id, character_id, name, type, file_url, cover_url, thumbnail_url, meta)
       VALUES (?, ?, ?, ?, ?, '', '', ?)`,
      [ projectId, characterId, name, type, normalizeGeneratedAssetReference(this.app, String(payload.file_url || '').trim()), String(payload.meta || '').trim() || null ]
    );
    return await this.findById(result.insertId);
  }

  /**
   * 更新资产元信息和文件地址。
   * @param {number} id 资产 id，例如 `5`。
   * @param {Record<string, unknown>} payload 局部补丁，例如 `{ meta: "便利店外景背景" }`。
   * @returns {Promise<object>} 更新后的资产对象。
   * @example
   * await service.update(5, { meta: "便利店外景背景" })
   * // => { id: 5, meta: "便利店外景背景" }
   */
  async update(id, payload) {
    const current = await this.findById(id);
    if (!current) throw new Error('asset not found');
    const characterId = payload.character_id == null ? null : Number(payload.character_id);
    if (characterId) await this.ensureCharacterInProject(characterId, current.project_id);
    const nextFile = Object.prototype.hasOwnProperty.call(payload, 'file_url')
      ? normalizeGeneratedAssetReference(this.app, String(payload.file_url || '').trim())
      : normalizeGeneratedAssetReference(this.app, current.file_url);
    await this.pool.execute(
      `UPDATE assets
       SET character_id = ?, name = ?, type = ?, file_url = ?, cover_url = ?, thumbnail_url = ?, meta = ?
       WHERE id = ?`,
      [
        Object.prototype.hasOwnProperty.call(payload, 'character_id') ? characterId : (current.character_id ?? null),
        Object.prototype.hasOwnProperty.call(payload, 'name') ? String(payload.name || '').trim() || current.name : current.name,
        Object.prototype.hasOwnProperty.call(payload, 'type') ? String(payload.type || '').trim() || current.type : current.type,
        nextFile,
        nextFile !== normalizeGeneratedAssetReference(this.app, current.file_url) ? '' : normalizeGeneratedAssetReference(this.app, current.cover_url),
        nextFile !== normalizeGeneratedAssetReference(this.app, current.file_url) ? '' : normalizeGeneratedAssetReference(this.app, current.thumbnail_url),
        Object.prototype.hasOwnProperty.call(payload, 'meta') ? String(payload.meta || '').trim() || null : current.meta || null,
        id,
      ]
    );
    return await this.findById(id);
  }

  /**
   * 软删除未被镜头引用的资产。
   * @param {number} id 资产 id，例如 `5`。
   * @returns {Promise<void>} 删除标记写入后返回。
   * @example
   * await service.softDelete(5)
   * // => void
   */
  async softDelete(id) {
    const [ rows ] = await this.pool.query(`
      SELECT COUNT(*) AS count
      FROM storyboard_asset_usages sau
      JOIN storyboards s ON s.id = sau.storyboard_id
      WHERE sau.asset_id = ? AND s.deleted_at IS NULL
    `, [ id ]);
    if (Number(rows[0]?.count || 0) > 0) {
      throw new Error(`该资产已被 ${Number(rows[0].count)} 个镜头引用，暂不允许删除。请先让相关镜头改用其他资产或重新生成封面。`);
    }
    await this.pool.execute('UPDATE assets SET deleted_at = NOW() WHERE id = ?', [ id ]);
  }

  /**
   * 缺少缩略图时，基于原图或封面补一张预览图。
   * @param {object} asset 资产对象，例如 `{ id: 5, file_url: "https://..." }`。
   * @returns {Promise<void>} 预览图存在后返回。
   * @example
   * await service.ensurePreview({ id: 5, file_url: "https://example.com/a.png" })
   * // => void
   */
  async ensurePreview(asset) {
    if (!asset || asset.thumbnail_url) {
      return;
    }
    const source = asset.cover_url || asset.file_url;
    if (!source) {
      return;
    }
    const preview = await createPreviewFromSource(this.app, source, 'assets', `asset-${asset.id}`, assetPreviewSpec());
    await this.pool.execute('UPDATE assets SET thumbnail_url = ? WHERE id = ?', [ preview, asset.id ]);
    asset.thumbnail_url = resolveUrl(this.app, preview, this.app.config.storyboard.publicAppBaseUrl || '');
  }

  /**
   * 判断当前资产类型是否允许自动生成封面。
   * @param {string} assetType 资产类型，例如 `"scene"`。
   * @returns {boolean} 可生成时返回 `true`。
   * @example
   * service.canGenerateSceneAssetCover("scene")
   * // => true
   */
  canGenerateSceneAssetCover(assetType) {
    const value = String(assetType || '').trim().toLowerCase();
    return value.includes('scene') || value.includes('background') || value.includes('场景') || value.includes('背景');
  }

  /**
   * 生成场景资产封面所需的 prompt 文本。
   * @param {object} asset 资产对象，例如 `{ name: "CG背景", type: "scene" }`。
   * @returns {string} 最终 prompt 文本。
   * @example
   * service.buildCoverPrompt({ name: "CG背景", type: "scene", meta: "便利店外景" })
   * // => "..."
   */
  buildCoverPrompt(asset) {
    return buildAssetCoverPrompt(asset).prompt;
  }

  /**
   * 预览资产封面生成参数和 prompt。
   * @param {number} id 资产 id，例如 `5`。
   * @returns {Promise<object>} 预览信息。
   * @example
   * await service.previewCoverGeneration(5)
   * // => { action: "asset-cover", model: "wan2.7-image-pro", final_prompt: "..." }
   */
  async previewCoverGeneration(id) {
    const asset = await this.findById(id);
    if (!asset) throw new Error('asset not found');
    if (!this.canGenerateSceneAssetCover(asset.type)) {
      throw new Error('当前资产类型不支持生成封面');
    }
    const coverPrompt = buildAssetCoverPrompt(asset);
    return {
      action: 'asset-cover',
      model: this.app.config.storyboard.wanxModel || 'wan2.7-image-pro',
      fields: {
        资产名称: asset.name,
        资产类型: asset.type,
        说明: asset.meta,
        输出: '场景资产封面',
      },
      template: coverPrompt.template,
      prompt_blueprint: coverPrompt.blueprint,
      final_prompt: coverPrompt.prompt,
      notes: [ '适用于场景/背景类资产，不会覆盖原始素材文件。' ],
    };
  }

  /**
   * 真正生成资产封面，并回写封面图和缩略图。
   * @param {number} id 资产 id，例如 `5`。
   * @returns {Promise<object>} 更新后的资产对象。
   * @example
   * await service.generateCover(5)
   * // => { id: 5, cover_url: "/generated/assets/asset-cover-5-....png" }
   */
  async generateCover(id) {
    const asset = await this.findById(id);
    if (!asset) throw new Error('asset not found');
    if (!this.canGenerateSceneAssetCover(asset.type)) {
      throw new Error('当前资产类型不支持生成封面');
    }
    const { generateWanxImage } = require('../lib/ai_clients');
    const imageUrl = await generateWanxImage(this.app, this.buildCoverPrompt(asset), this.app.config.storyboard.wanxModel || 'wan2.7-image-pro');
    const filename = `${sanitizeFileName(`asset-cover-${id}`)}-${Date.now()}.png`;
    const stored = await downloadAndStore(this.app, imageUrl, 'assets', filename, 'image/png');
    const previewFilename = `${path.basename(filename, path.extname(filename))}.thumb.webp`;
    const previewPath = await createPreviewFromLocalPath(this.app, stored.localPath, 'assets', previewFilename, assetPreviewSpec());
    await this.pool.execute('UPDATE assets SET cover_url = ?, thumbnail_url = ? WHERE id = ?', [ stored.publicPath, previewPath, id ]);
    return await this.findById(id);
  }
}

module.exports = AssetService;
