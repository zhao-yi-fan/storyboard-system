const Service = require('egg').Service;
const {
  normalizeGeneratedAssetReference,
  isGeneratedAssetPath,
} = require('../lib/generated_asset');
import { applyImageVersion, lockImageEntity } from '../lib/asset_image_version';
import type { DbConnection, DbRow } from '../lib/entity';

class PersonalAssetImportService extends Service {
  async execute(
    personalId: number,
    projectId: number,
    userId: number,
    target?: { type: string; id: number },
    requirementId?: number,
  ) {
    for (const id of [
      personalId,
      projectId,
      userId,
      ...(target ? [target.id] : []),
      ...(requirementId ? [requirementId] : []),
    ]) {
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error('资产参数不合法');
    }
    const conn: DbConnection = await this.app.mysqlPool.getConnection();
    let result;
    try {
      await conn.beginTransaction();
      const [projects] = await conn.query(
        'SELECT id FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL FOR UPDATE',
        [projectId, userId],
      );
      if (!projects.length) throw new Error('无权访问该项目');
      const [sources] = await conn.query(
        'SELECT * FROM personal_assets WHERE id = ? AND user_id = ? AND deleted_at IS NULL FOR UPDATE',
        [personalId, userId],
      );
      const source = sources[0];
      if (!source) throw new Error('个人资产不存在');
      if (!['character', 'scene', 'prop'].includes(source.kind))
        throw new Error('不支持的个人资产类型');
      const file = normalizeGeneratedAssetReference(this.app, source.file_url);
      if (
        !file ||
        !/\.(png|jpe?g|webp|gif|avif|bmp|svg)(?:\?|$)/i.test(file) ||
        !(isGeneratedAssetPath(this.app, file) || /^https?:\/\//i.test(file))
      )
        throw new Error('个人资产没有可用的图片');
      const preview = normalizeGeneratedAssetReference(
        this.app,
        source.preview_url || source.file_url,
      );
      let requirement: DbRow | undefined;
      if (requirementId) {
        const [rows] = await conn.query(
          'SELECT * FROM asset_requirements WHERE id = ? AND project_id = ? AND deleted_at IS NULL FOR UPDATE',
          [requirementId, projectId],
        );
        requirement = rows[0];
        if (!requirement) throw new Error('资产需求不存在');
        if (requirement.kind !== source.kind) throw new Error('个人资产类型与需求不匹配');
        if (requirement.linked_entity_id)
          target = {
            type: String(requirement.linked_entity_type),
            id: Number(requirement.linked_entity_id),
          };
      }
      const type = source.kind === 'character' ? 'character' : 'asset';
      let entity: DbRow;
      if (target) {
        entity = await lockImageEntity(conn, target.type, target.id, userId, projectId);
        if (target.type !== type || (type === 'asset' && entity.type !== source.kind))
          throw new Error('个人资产类型与目标资产不匹配');
      } else {
        const name = requirement?.name || source.name;
        const description = requirement?.description ?? source.description ?? '';
        if (type === 'character') {
          const [created] = await conn.execute(
            "INSERT INTO characters (project_id, name, description, avatar_url, design_sheet_url, source_personal_asset_id) VALUES (?, ?, ?, '', '', ?)",
            [projectId, name, description, personalId],
          );
          entity = { id: created.insertId, project_id: projectId };
        } else {
          const [created] = await conn.execute(
            "INSERT INTO assets (project_id, name, type, meta, file_url, cover_url, thumbnail_url, source_personal_asset_id) VALUES (?, ?, ?, ?, ?, '', '', ?)",
            [projectId, name, source.kind, description, file, personalId],
          );
          entity = { id: created.insertId, project_id: projectId };
        }
      }
      const id = Number(entity.id);
      if (requirementId)
        await conn.execute(
          'UPDATE asset_requirements SET linked_entity_type = ?, linked_entity_id = ? WHERE id = ? AND project_id = ?',
          [type, id, requirementId, projectId],
        );
      const oldFile = normalizeGeneratedAssetReference(
        this.app,
        type === 'character' ? entity.design_sheet_url : entity.cover_url || entity.file_url,
      );
      const [versions] = await conn.query(
        'SELECT * FROM asset_versions WHERE entity_type = ? AND entity_id = ? AND deleted_at IS NULL ORDER BY id DESC FOR UPDATE',
        [type, id],
      );
      if (
        oldFile &&
        !versions.some(
          (version: DbRow) =>
            normalizeGeneratedAssetReference(this.app, version.file_url) === oldFile,
        )
      ) {
        await this.insertVersion(
          conn,
          userId,
          type,
          id,
          oldFile,
          type === 'character' ? oldFile : String(entity.thumbnail_url || oldFile),
          'legacy-import',
          null,
        );
      }
      const current = versions.find(
        (version: DbRow) =>
          Number(version.is_current) === 1 &&
          normalizeGeneratedAssetReference(this.app, version.file_url) === file,
      );
      const unchanged = Boolean(target && oldFile === file);
      const versionId =
        unchanged && current
          ? Number(current.id)
          : await this.insertVersion(
              conn,
              userId,
              type,
              id,
              file,
              preview,
              'personal-import',
              personalId,
            );
      if (!unchanged || !current)
        await applyImageVersion(conn, type, id, {
          id: versionId,
          file_url: file,
          preview_url: preview,
        });
      await conn.commit();
      result = { entity_type: type, entity_id: id, version_id: versionId, changed: !unchanged };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
    // Return committed identity; frontend refresh is a separate retryable operation.
    return result;
  }

  async insertVersion(
    conn: DbConnection,
    userId: number,
    type: string,
    id: number,
    file: string,
    preview: string,
    source: string,
    personalId: number | null,
  ) {
    const [result] = await conn.execute(
      `INSERT INTO asset_versions
      (owner_user_id, scope_type, entity_type, entity_id, file_url, preview_url, model, prompt, status, is_current, source_type, source_personal_asset_id)
      VALUES (?, 'project', ?, ?, ?, ?, ?, '', 'succeeded', 0, ?, ?)`,
      [
        userId,
        type,
        id,
        file,
        preview,
        source === 'personal-import' ? 'personal-import' : 'legacy',
        source,
        personalId,
      ],
    );
    return Number(result.insertId);
  }
}
module.exports = PersonalAssetImportService;
