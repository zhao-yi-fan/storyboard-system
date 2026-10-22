'use strict';

const Service = require('egg').Service;
import type { DbRow } from '../lib/entity';
const { normalizeGeneratedAssetReference } = require('../lib/generated_asset');
const { mapPersonalAsset } = require('../lib/asset_workspace_mapper');
const { ASSET_KIND, ENTITY_TYPE } = require('../lib/domain_constants');

const VALID_KINDS = new Set(Object.values(ASSET_KIND));

class AssetWorkspaceService extends Service {
  get pool() {
    return this.app.mysqlPool;
  }

  async ensureOwnedProject(projectId: number, userId: number) {
    const [rows] = await this.pool.query(
      'SELECT id FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [projectId, userId],
    );
    if (!rows.length) throw new Error('无权访问该项目');
  }

  mapPersonal(row: DbRow) {
    return mapPersonalAsset(this.app, row);
  }

  async listPersonal(userId: number, kind: string) {
    const params: (number | string)[] = [userId];
    const kindFilter = kind ? ' AND kind = ?' : '';
    if (kind) params.push(kind);
    const [rows] = await this.pool.query(
      `SELECT * FROM personal_assets WHERE user_id = ? AND deleted_at IS NULL${kindFilter}
       ORDER BY updated_at DESC`,
      params,
    );
    return rows.map((row: DbRow) => this.mapPersonal(row));
  }

  async savePersonal(userId: number, payload: Record<string, unknown>) {
    const kind = String(payload.kind || '').trim();
    const name = String(payload.name || '').trim();
    if (!VALID_KINDS.has(kind)) throw new Error('不支持的个人资产类型');
    if (!name) throw new Error('资产名称不能为空');
    const sourceType = payload.source_entity_type || null;
    const sourceId = payload.source_entity_id || null;
    const [existing] =
      sourceType && sourceId
        ? await this.pool.query(
            `SELECT id FROM personal_assets
           WHERE user_id = ? AND source_entity_type = ? AND source_entity_id = ?
             AND deleted_at IS NULL LIMIT 1`,
            [userId, sourceType, sourceId],
          )
        : [[]];
    if (existing.length) {
      await this.pool.execute(
        `UPDATE personal_assets SET kind = ?, name = ?, description = ?, file_url = ?,
         preview_url = ?, metadata_json = ?, source_project_id = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          kind,
          name,
          String(payload.description || ''),
          normalizeGeneratedAssetReference(this.app, String(payload.file_url || '')),
          normalizeGeneratedAssetReference(this.app, String(payload.preview_url || '')),
          payload.metadata_json ? JSON.stringify(payload.metadata_json) : null,
          payload.source_project_id || null,
          existing[0].id,
        ],
      );
      const [updatedRows] = await this.pool.query('SELECT * FROM personal_assets WHERE id = ?', [
        existing[0].id,
      ]);
      return this.mapPersonal(updatedRows[0]);
    }
    const [result] = await this.pool.execute(
      `INSERT INTO personal_assets
       (user_id, kind, name, description, file_url, preview_url, metadata_json,
        source_project_id, source_entity_type, source_entity_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        kind,
        name,
        String(payload.description || ''),
        normalizeGeneratedAssetReference(this.app, String(payload.file_url || '')),
        normalizeGeneratedAssetReference(this.app, String(payload.preview_url || '')),
        payload.metadata_json ? JSON.stringify(payload.metadata_json) : null,
        payload.source_project_id || null,
        sourceType,
        sourceId,
      ],
    );
    const [rows] = await this.pool.query('SELECT * FROM personal_assets WHERE id = ?', [
      result.insertId,
    ]);
    return this.mapPersonal(rows[0]);
  }

  async saveCharacterToPersonal(characterId: number, userId: number) {
    const character = await this.ctx.service.character.findById(characterId);
    if (!character) throw new Error('character not found');
    await this.ensureOwnedProject(character.project_id, userId);
    return await this.savePersonal(userId, {
      kind: ASSET_KIND.CHARACTER,
      name: character.name,
      description: character.description,
      file_url: character.design_sheet_url || character.avatar_url,
      preview_url: character.design_sheet_url || character.avatar_url,
      source_project_id: character.project_id,
      source_entity_type: ENTITY_TYPE.CHARACTER,
      source_entity_id: character.id,
    });
  }

  async saveAssetToPersonal(assetId: number, userId: number) {
    const asset = await this.ctx.service.asset.findById(assetId);
    if (!asset) throw new Error('asset not found');
    await this.ensureOwnedProject(asset.project_id, userId);
    return await this.savePersonal(userId, {
      kind: asset.type === ASSET_KIND.PROP ? ASSET_KIND.PROP : ASSET_KIND.SCENE,
      name: asset.name,
      description: asset.meta,
      file_url: asset.cover_url || asset.file_url,
      preview_url: asset.thumbnail_url || asset.cover_url,
      source_project_id: asset.project_id,
      source_entity_type: ENTITY_TYPE.ASSET,
      source_entity_id: asset.id,
    });
  }

  async importPersonal(personalAssetId: number, projectId: number, userId: number, requirementId?: number) {
    return await this.ctx.service.personalAssetImport.execute(personalAssetId, projectId, userId, undefined, requirementId);
  }

  async applyPersonalImage(personalAssetId: number, projectId: number, userId: number, entityType: string, entityId: number) {
    return await this.ctx.service.personalAssetImport.execute(personalAssetId, projectId, userId, { type: entityType, id: entityId });
  }
}

module.exports = AssetWorkspaceService;
