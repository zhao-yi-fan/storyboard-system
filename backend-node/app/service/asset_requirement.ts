'use strict';

const Service = require('egg').Service;
const { resolveUrl } = require('../lib/generated_asset');
const { deriveAssetRequirementStatus } = require('../lib/asset_workspace_mapper');
const {
  ASSET_KIND,
  ENTITY_TYPE,
  GENERATION_STATUS,
} = require('../lib/domain_constants');

class AssetRequirementService extends Service {
  get pool() {
    return this.app.mysqlPool;
  }

  deriveRequirementStatus(currentStatus: any, hasMedia: boolean) {
    return deriveAssetRequirementStatus(currentStatus, hasMedia);
  }

  async queryRequirements(projectId: number, chapterId?: number) {
    const params = [projectId];
    let chapterFilter = '';
    if (chapterId) {
      chapterFilter = ' AND ar.chapter_id = ?';
      params.push(chapterId);
    }
    const [rows] = await this.pool.query(
      `SELECT ar.*, c.title AS chapter_title,
        ch.avatar_url AS character_avatar_url,
        CASE WHEN ar.linked_entity_type = 'character'
          THEN COALESCE(NULLIF(ch.design_sheet_url, ''), ch.avatar_url)
          ELSE COALESCE(NULLIF(a.cover_url, ''), a.file_url)
        END AS file_url,
        CASE WHEN ar.linked_entity_type = 'character'
          THEN COALESCE(NULLIF(ch.avatar_url, ''), ch.design_sheet_url)
          ELSE COALESCE(NULLIF(a.thumbnail_url, ''), NULLIF(a.cover_url, ''), a.file_url)
        END AS preview_url
       FROM asset_requirements ar
       JOIN chapters c ON c.id = ar.chapter_id AND c.deleted_at IS NULL
       LEFT JOIN characters ch ON ar.linked_entity_type = 'character' AND ch.id = ar.linked_entity_id AND ch.deleted_at IS NULL
       LEFT JOIN assets a ON ar.linked_entity_type = 'asset' AND a.id = ar.linked_entity_id AND a.deleted_at IS NULL
       WHERE ar.project_id = ? AND ar.deleted_at IS NULL${chapterFilter}
       ORDER BY c.sort_order, FIELD(ar.kind, 'character', 'scene', 'prop'), ar.id`,
      params,
    );
    return rows;
  }

  async insertLegacyVersion(conn: any, project: any, entityType: string, entityId: number, fileUrl: string, previewUrl: string) {
    if (!project.user_id || !fileUrl) return;
    const [versions] = await conn.query(
      `SELECT id FROM asset_versions
       WHERE entity_type = ? AND entity_id = ? AND deleted_at IS NULL LIMIT 1`,
      [entityType, entityId],
    );
    if (versions.length) return;
    await conn.execute(
      `INSERT INTO asset_versions
       (owner_user_id, scope_type, entity_type, entity_id, file_url, preview_url,
        model, prompt, status, is_current, source_type)
       VALUES (?, 'project', ?, ?, ?, ?, 'legacy', '', 'succeeded', 1, 'legacy-import')`,
      [project.user_id, entityType, entityId, fileUrl, previewUrl || ''],
    );
  }

  async syncAssetRequirements(projectId: number, chapterId: number | null = null) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const [projects] = await conn.query(
        'SELECT id, user_id FROM projects WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
        [projectId],
      );
      if (!projects.length) throw new Error('project not found');

      if (chapterId) {
        const [chapters] = await conn.query(
          'SELECT id FROM chapters WHERE id = ? AND project_id = ? AND deleted_at IS NULL',
          [chapterId, projectId],
        );
        if (!chapters.length) throw new Error('chapter not found');
      }

      const scopedParams = [projectId];
      const scopedChapterFilter = chapterId ? ' AND chapter_id = ?' : '';
      if (chapterId) scopedParams.push(chapterId);
      const [existingRequirements] = await conn.query(
        `SELECT * FROM asset_requirements
         WHERE project_id = ? AND deleted_at IS NULL${scopedChapterFilter}
         ORDER BY id`,
        scopedParams,
      );
      const expected = [];

      const [characters] = await conn.query(
        `SELECT s.chapter_id, c.id, c.name, c.description, c.avatar_url, c.design_sheet_url,
                COUNT(DISTINCT s.id) AS source_count
         FROM scene_characters sc
         JOIN scenes s ON s.id = sc.scene_id AND s.deleted_at IS NULL
         JOIN chapters cp ON cp.id = s.chapter_id AND cp.deleted_at IS NULL
         JOIN characters c ON c.id = sc.character_id AND c.deleted_at IS NULL
         WHERE s.project_id = ?${chapterId ? ' AND s.chapter_id = ?' : ''}
         GROUP BY s.chapter_id, c.id, c.name, c.description, c.avatar_url, c.design_sheet_url`,
        chapterId ? [projectId, chapterId] : [projectId],
      );
      for (const character of characters) {
        const fileUrl = character.design_sheet_url || character.avatar_url || '';
        expected.push({
          chapterId: Number(character.chapter_id),
          kind: ASSET_KIND.CHARACTER,
          name: character.name,
          description: character.description || '',
          entityType: ENTITY_TYPE.CHARACTER,
          entityId: Number(character.id),
          sourceCount: Number(character.source_count || 1),
          fileUrl,
          previewUrl: character.avatar_url || fileUrl,
        });
        await this.insertLegacyVersion(
          conn,
          projects[0],
          ENTITY_TYPE.CHARACTER,
          character.id,
          fileUrl,
          character.avatar_url || fileUrl,
        );
      }

      const [sceneRows] = await conn.query(
        `SELECT chapter_id, COALESCE(NULLIF(location, ''), title) AS name,
                description, cover_url, cover_preview_url
         FROM scenes
         WHERE project_id = ? AND deleted_at IS NULL${chapterId ? ' AND chapter_id = ?' : ''}
         ORDER BY chapter_id, sort_order`,
        chapterId ? [projectId, chapterId] : [projectId],
      );
      const scenesByChapterAndName = new Map();
      for (const scene of sceneRows) {
        const name = String(scene.name || '').trim();
        if (!name) continue;
        const key = `${scene.chapter_id}:${name}`;
        const current = scenesByChapterAndName.get(key) || {
          chapter_id: Number(scene.chapter_id),
          name,
          description: '',
          cover_url: '',
          preview_url: '',
          source_count: 0,
        };
        current.description ||= scene.description || '';
        current.cover_url ||= scene.cover_url || '';
        current.preview_url ||= scene.cover_preview_url || '';
        current.source_count += 1;
        scenesByChapterAndName.set(key, current);
      }
      for (const scene of scenesByChapterAndName.values()) {
        const [assets] = await conn.query(
          `SELECT id, cover_url, thumbnail_url FROM assets
           WHERE project_id = ? AND type = 'scene' AND name = ? AND deleted_at IS NULL LIMIT 1`,
          [projectId, scene.name],
        );
        let assetId;
        if (assets.length) {
          assetId = Number(assets[0].id);
          await conn.execute(
            `UPDATE assets SET
              cover_url = CASE WHEN cover_url = '' THEN ? ELSE cover_url END,
              thumbnail_url = CASE WHEN thumbnail_url = '' THEN ? ELSE thumbnail_url END,
              meta = COALESCE(meta, ?)
             WHERE id = ?`,
            [
              scene.cover_url || '',
              scene.preview_url || '',
              scene.description ? JSON.stringify({ description: scene.description }) : null,
              assetId,
            ],
          );
        } else {
          const [insert] = await conn.execute(
            `INSERT INTO assets
             (project_id, character_id, name, type, file_url, cover_url, thumbnail_url, meta)
             VALUES (?, NULL, ?, 'scene', '', ?, ?, ?)`,
            [
              projectId,
              scene.name,
              scene.cover_url || '',
              scene.preview_url || '',
              scene.description ? JSON.stringify({ description: scene.description }) : null,
            ],
          );
          assetId = Number(insert.insertId);
        }
        const [assetRows] = await conn.query(
          'SELECT cover_url, thumbnail_url, file_url FROM assets WHERE id = ?',
          [assetId],
        );
        const fileUrl = assetRows[0]?.cover_url || assetRows[0]?.file_url || '';
        expected.push({
          chapterId: Number(scene.chapter_id),
          kind: ASSET_KIND.SCENE,
          name: scene.name,
          description: scene.description || '',
          entityType: ENTITY_TYPE.ASSET,
          entityId: assetId,
          sourceCount: Number(scene.source_count || 1),
          fileUrl,
          previewUrl: assetRows[0]?.thumbnail_url || fileUrl,
        });
        await this.insertLegacyVersion(
          conn,
          projects[0],
          ENTITY_TYPE.ASSET,
          assetId,
          fileUrl,
          assetRows[0]?.thumbnail_url || fileUrl,
        );
      }

      const [usedProps] = await conn.query(
        `SELECT s.chapter_id, a.id, a.name, a.type, a.meta, a.file_url, a.cover_url, a.thumbnail_url,
                COUNT(DISTINCT s.id) AS source_count
         FROM scene_asset_usages sau
         JOIN scenes s ON s.id = sau.scene_id AND s.deleted_at IS NULL
         JOIN assets a ON a.id = sau.asset_id AND a.deleted_at IS NULL
         WHERE s.project_id = ?${chapterId ? ' AND s.chapter_id = ?' : ''}
         GROUP BY s.chapter_id, a.id, a.name, a.type, a.meta, a.file_url, a.cover_url, a.thumbnail_url`,
        chapterId ? [projectId, chapterId] : [projectId],
      );
      const propExpectedKeys = new Set();
      const appendProp = (row: any, sourceCount: any) => {
        const key = `${row.chapter_id}:${row.id}`;
        if (propExpectedKeys.has(key)) return;
        propExpectedKeys.add(key);
        expected.push({
          chapterId: Number(row.chapter_id),
          kind: ASSET_KIND.PROP,
          name: row.name,
          description: this.ctx.service.asset.normalizeMetaForApi(row.meta),
          entityType: ENTITY_TYPE.ASSET,
          entityId: Number(row.id),
          sourceCount: Number(sourceCount || 1),
          fileUrl: row.cover_url || row.file_url || '',
          previewUrl: row.thumbnail_url || row.cover_url || row.file_url || '',
        });
      };
      for (const prop of usedProps) {
        if (/(prop|道具)/i.test(String(prop.type || ''))) appendProp(prop, prop.source_count);
      }

      for (const requirement of existingRequirements.filter((item: any) => item.kind === ASSET_KIND.PROP)) {
        let [assets] = await conn.query(
          `SELECT id, name, type, meta, file_url, cover_url, thumbnail_url
           FROM assets WHERE id = ? AND project_id = ? AND deleted_at IS NULL`,
          [requirement.linked_entity_id, projectId],
        );
        if (!assets.length) {
          [assets] = await conn.query(
            `SELECT id, name, type, meta, file_url, cover_url, thumbnail_url
             FROM assets WHERE project_id = ? AND type = 'prop' AND name = ? AND deleted_at IS NULL LIMIT 1`,
            [projectId, requirement.name],
          );
        }
        if (!assets.length) {
          const [insert] = await conn.execute(
            `INSERT INTO assets (project_id, character_id, name, type, file_url, cover_url, thumbnail_url, meta)
             VALUES (?, NULL, ?, 'prop', '', '', '', ?)`,
            [
              projectId,
              requirement.name,
              requirement.description
                ? JSON.stringify({ description: requirement.description })
                : null,
            ],
          );
          assets = [
            {
              id: insert.insertId,
              name: requirement.name,
              type: ASSET_KIND.PROP,
              meta: requirement.description || '',
              file_url: '',
              cover_url: '',
              thumbnail_url: '',
            },
          ];
        }
        appendProp({ ...assets[0], chapter_id: requirement.chapter_id }, requirement.source_count);
      }

      const existingByEntity = new Map();
      const existingByName = new Map();
      for (const requirement of existingRequirements) {
        const entityKey = `${requirement.chapter_id}:${requirement.kind}:${requirement.linked_entity_type}:${requirement.linked_entity_id}`;
        if (!existingByEntity.has(entityKey)) existingByEntity.set(entityKey, []);
        existingByEntity.get(entityKey).push(requirement);
        const nameKey = `${requirement.chapter_id}:${requirement.kind}:${requirement.name}`;
        if (!existingByName.has(nameKey)) existingByName.set(nameKey, []);
        existingByName.get(nameKey).push(requirement);
      }

      const retainedIds = new Set();
      for (const item of expected) {
        const entityKey = `${item.chapterId}:${item.kind}:${item.entityType}:${item.entityId}`;
        const nameKey = `${item.chapterId}:${item.kind}:${item.name}`;
        const candidates = [
          ...(existingByEntity.get(entityKey) || []),
          ...(existingByName.get(nameKey) || []),
        ].filter(
          (candidate, index, rows) =>
            !retainedIds.has(Number(candidate.id)) &&
            rows.findIndex((row: any) => Number(row.id) === Number(candidate.id)) === index,
        );
        const current = candidates[0];
        const hasMedia = Boolean(item.fileUrl);
        const status = this.deriveRequirementStatus(current?.status, hasMedia);
        const errorMessage = status === GENERATION_STATUS.FAILED ? current?.error_message || null : null;
        if (current) {
          retainedIds.add(Number(current.id));
          await conn.execute(
            `UPDATE asset_requirements SET name = ?, description = ?, status = ?,
              linked_entity_type = ?, linked_entity_id = ?, source_count = ?, error_message = ?
             WHERE id = ?`,
            [
              item.name,
              item.description,
              status,
              item.entityType,
              item.entityId,
              item.sourceCount,
              errorMessage,
              current.id,
            ],
          );
        } else {
          const [insert] = await conn.execute(
            `INSERT INTO asset_requirements
             (project_id, chapter_id, kind, name, description, status,
              linked_entity_type, linked_entity_id, source_count, error_message)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              projectId,
              item.chapterId,
              item.kind,
              item.name,
              item.description,
              status,
              item.entityType,
              item.entityId,
              item.sourceCount,
              errorMessage,
            ],
          );
          retainedIds.add(Number(insert.insertId));
        }
      }

      const retiredIds = existingRequirements
        .filter((item: any) => !retainedIds.has(Number(item.id)))
        .map((item: any) => Number(item.id));
      if (retiredIds.length) {
        await conn.query(
          `UPDATE asset_requirements SET deleted_at = NOW() WHERE id IN (${retiredIds.map(() => '?').join(',')})`,
          retiredIds,
        );
      }
      await conn.commit();
      return { expected_count: expected.length, retired_count: retiredIds.length };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async listRequirements(projectId: number, chapterId?: number) {
    await this.syncAssetRequirements(projectId, chapterId);
    const rows = await this.queryRequirements(projectId, chapterId);
    const base = this.app.config.storyboard.publicAppBaseUrl || '';
    return rows.map((row: any) => {
      const isCharacter = row.linked_entity_type === ENTITY_TYPE.CHARACTER;
      const canGenerate = !isCharacter || Boolean(row.character_avatar_url);
      return {
        ...row,
        id: Number(row.id),
        project_id: Number(row.project_id),
        chapter_id: Number(row.chapter_id),
        linked_entity_id: row.linked_entity_id === null || row.linked_entity_id === undefined ? null : Number(row.linked_entity_id),
        file_url: resolveUrl(this.app, row.file_url || '', base),
        preview_url: resolveUrl(this.app, row.preview_url || '', base),
        can_generate: canGenerate,
        blocking_reason: canGenerate ? '' : '缺少角色参考图，请先到项目资产库补充',
      };
    });
  }

  async confirmRequirement(id: number) {
    const [rows] = await this.pool.query(
      'SELECT * FROM asset_requirements WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    if (!rows.length) throw new Error('资产需求不存在');
    if (!rows[0].linked_entity_id) throw new Error('资产需求尚未绑定资产');
    await this.pool.execute(
      "UPDATE asset_requirements SET status = 'confirmed', error_message = NULL WHERE id = ?",
      [id],
    );
    return (await this.listRequirements(rows[0].project_id, rows[0].chapter_id)).find(
      (item: any) => item.id === Number(id),
    );
  }

  async generateRequirements(projectId: number, chapterId?: number, requirementId?: number) {
    const requirements = (await this.listRequirements(projectId, chapterId)).filter((item: any) =>
      requirementId
        ? item.id === Number(requirementId) && item.status !== GENERATION_STATUS.GENERATING
        : item.status === GENERATION_STATUS.PENDING || item.status === GENERATION_STATUS.FAILED,
    );
    const results = [];
    const generatedEntities = new Set();
    for (const item of requirements) {
      if (!item.can_generate) {
        results.push({
          id: item.id,
          status: 'blocked',
          error: item.blocking_reason || '资产尚未满足生成条件',
        });
        continue;
      }
      try {
        const entityKey = `${item.linked_entity_type}:${item.linked_entity_id}`;
        if (generatedEntities.has(entityKey)) {
          results.push({ id: item.id, status: GENERATION_STATUS.GENERATED, reused: true });
          continue;
        }
        await this.pool.execute(
          "UPDATE asset_requirements SET status = 'generating', error_message = NULL WHERE id = ?",
          [item.id],
        );
        if (item.linked_entity_type === ENTITY_TYPE.CHARACTER) {
          await this.ctx.service.character.generateDesignSheet(item.linked_entity_id);
        } else {
          await this.ctx.service.asset.generateCover(item.linked_entity_id);
        }
        generatedEntities.add(entityKey);
        results.push({ id: item.id, status: GENERATION_STATUS.GENERATED });
      } catch (error) {
        this.ctx.logger.error(
          '[asset-workspace] requirement generation failed: project=%s requirement=%s entity=%s:%s error=%s',
          projectId,
          item.id,
          item.linked_entity_type,
          item.linked_entity_id,
          (error as any)?.stack || (error as any)?.message || error,
        );
        await this.pool.execute(
          "UPDATE asset_requirements SET status = 'failed', error_message = ? WHERE id = ?",
          [(error as Error).message || '生成失败', item.id],
        );
        results.push({ id: item.id, status: GENERATION_STATUS.FAILED, error: (error as Error).message || '生成失败' });
      }
    }
    return results;
  }
}

module.exports = AssetRequirementService;
