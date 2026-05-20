'use strict';
// @ts-nocheck

const Service = require('egg').Service;
const path = require('node:path');
const { createPreviewFromSource, assetPreviewSpec, downloadAndStore, createPreviewFromLocalPath, sanitizeFileName } = require('../lib/media');
const { normalizeGeneratedAssetReference, resolveUrl } = require('../lib/generated_asset');

class AssetService extends Service {
  get pool() {
    return this.app.mysqlPool;
  }

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

  async ensureProjectExists(projectId) {
    const [ rows ] = await this.pool.query('SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL', [ projectId ]);
    if (!rows.length) throw new Error('project not found');
  }

  async ensureCharacterInProject(characterId, projectId) {
    const [ rows ] = await this.pool.query(
      'SELECT id FROM characters WHERE id = ? AND project_id = ? AND deleted_at IS NULL',
      [ characterId, projectId ]
    );
    if (!rows.length) throw new Error('character not found');
  }

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
    asset.thumbnail_url = preview;
  }

  canGenerateSceneAssetCover(assetType) {
    const value = String(assetType || '').trim().toLowerCase();
    return value.includes('scene') || value.includes('background') || value.includes('场景') || value.includes('背景');
  }

  buildCoverPrompt(asset) {
    let prompt = '为漫剧分镜系统生成一张场景资产封面图。';
    if (asset.name) prompt += ` 资产名称：${asset.name}。`;
    if (asset.type) prompt += ` 资产类型：${asset.type}。`;
    if (asset.meta) prompt += ` 说明：${asset.meta}。`;
    prompt += ' 画面要求：单一场景封面，构图清晰，写实电影感，适合做背景或场景资产预览。输出要求：横版16比9，不要文字、水印、logo、海报排版。';
    return prompt;
  }

  async previewCoverGeneration(id) {
    const asset = await this.findById(id);
    if (!asset) throw new Error('asset not found');
    if (!this.canGenerateSceneAssetCover(asset.type)) {
      throw new Error('当前资产类型不支持生成封面');
    }
    return {
      action: 'asset-cover',
      model: this.app.config.storyboard.wanxModel || 'wanx2.0-t2i-turbo',
      fields: {
        资产名称: asset.name,
        资产类型: asset.type,
        说明: asset.meta,
        输出: '场景资产封面',
      },
      final_prompt: this.buildCoverPrompt(asset),
      notes: [ '适用于场景/背景类资产，不会覆盖原始素材文件。' ],
    };
  }

  async generateCover(id) {
    const asset = await this.findById(id);
    if (!asset) throw new Error('asset not found');
    if (!this.canGenerateSceneAssetCover(asset.type)) {
      throw new Error('当前资产类型不支持生成封面');
    }
    const { generateWanxImage } = require('../lib/ai_clients');
    const imageUrl = await generateWanxImage(this.app, this.buildCoverPrompt(asset), this.app.config.storyboard.wanxModel || 'qwen-image-2.0');
    const filename = `${sanitizeFileName(`asset-cover-${id}`)}-${Date.now()}.png`;
    const stored = await downloadAndStore(this.app, imageUrl, 'assets', filename, 'image/png');
    const previewFilename = `${path.basename(filename, path.extname(filename))}.thumb.webp`;
    const previewPath = await createPreviewFromLocalPath(this.app, stored.localPath, 'assets', previewFilename, assetPreviewSpec());
    await this.pool.execute('UPDATE assets SET cover_url = ?, thumbnail_url = ? WHERE id = ?', [ stored.publicPath, previewPath, id ]);
    return await this.findById(id);
  }
}

module.exports = AssetService;
