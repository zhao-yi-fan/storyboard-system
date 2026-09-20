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
      preview_url: character.avatar_url || character.design_sheet_url,
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

  async importPersonal(
    personalAssetId: number,
    projectId: number,
    userId: number,
    requirementId: number,
  ) {
    await this.ensureOwnedProject(projectId, userId);
    const [rows] = await this.pool.query(
      'SELECT * FROM personal_assets WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [personalAssetId, userId],
    );
    if (!rows.length) throw new Error('个人资产不存在');
    const item = rows[0];
    let requirement = null;
    if (requirementId) {
      const [requirements] = await this.pool.query(
        `SELECT * FROM asset_requirements
         WHERE id = ? AND project_id = ? AND deleted_at IS NULL`,
        [requirementId, projectId],
      );
      if (!requirements.length) throw new Error('资产需求不存在');
      requirement = requirements[0];
    }
    if (item.kind === ASSET_KIND.CHARACTER) {
      if (requirement && requirement.kind !== ASSET_KIND.CHARACTER)
        throw new Error('个人资产类型与需求不匹配');
      const character =
        requirement?.linked_entity_type === ENTITY_TYPE.CHARACTER && requirement.linked_entity_id
          ? await this.ctx.service.character.update(requirement.linked_entity_id, {
              name: item.name,
              description: item.description,
              avatar_url: item.preview_url || item.file_url,
              design_sheet_url: item.file_url,
            })
          : await this.ctx.service.character.create(projectId, {
              name: item.name,
              description: item.description,
              avatar_url: item.preview_url || item.file_url,
              design_sheet_url: item.file_url,
            });
      await this.pool.execute('UPDATE characters SET source_personal_asset_id = ? WHERE id = ?', [
        item.id,
        character.id,
      ]);
      if (requirementId) {
        await this.pool.execute(
          "UPDATE asset_requirements SET linked_entity_type = 'character', linked_entity_id = ?, status = 'generated', error_message = NULL WHERE id = ? AND project_id = ?",
          [character.id, requirementId, projectId],
        );
      }
      return {
        entity_type: ENTITY_TYPE.CHARACTER,
        entity: await this.ctx.service.character.findById(character.id),
      };
    }
    if (requirement && requirement.kind !== item.kind) throw new Error('个人资产类型与需求不匹配');
    const asset =
      requirement?.linked_entity_type === ENTITY_TYPE.ASSET && requirement.linked_entity_id
        ? await this.ctx.service.asset.update(requirement.linked_entity_id, {
            name: item.name,
            type: item.kind === ASSET_KIND.PROP ? ASSET_KIND.PROP : ASSET_KIND.SCENE,
            file_url: item.file_url,
            meta: item.description,
          })
        : await this.ctx.service.asset.create(projectId, {
            name: item.name,
            type: item.kind === ASSET_KIND.PROP ? ASSET_KIND.PROP : ASSET_KIND.SCENE,
            file_url: item.file_url,
            meta: item.description,
          });
    await this.pool.execute(
      'UPDATE assets SET source_personal_asset_id = ?, cover_url = ?, thumbnail_url = ? WHERE id = ?',
      [item.id, item.file_url || '', item.preview_url || '', asset.id],
    );
    if (requirementId) {
      await this.pool.execute(
        "UPDATE asset_requirements SET linked_entity_type = 'asset', linked_entity_id = ?, status = 'generated', error_message = NULL WHERE id = ? AND project_id = ?",
        [asset.id, requirementId, projectId],
      );
    }
    return {
      entity_type: ENTITY_TYPE.ASSET,
      entity: await this.ctx.service.asset.findById(asset.id),
    };
  }
}

module.exports = AssetWorkspaceService;
