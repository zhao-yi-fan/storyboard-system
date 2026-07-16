'use strict';
// @ts-nocheck

const Service = require('egg').Service;
const { resolveUrl, normalizeGeneratedAssetReference } = require('../lib/generated_asset');

const VALID_KINDS = new Set(['character', 'scene', 'prop', 'voice']);

class AssetWorkspaceService extends Service {
  get pool() {
    return this.app.mysqlPool;
  }

  async ensureOwnedProject(projectId, userId) {
    const [rows] = await this.pool.query(
      'SELECT id FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [projectId, userId],
    );
    if (!rows.length) throw new Error('无权访问该项目');
  }

  mapPersonal(row) {
    const base = this.app.config.storyboard.publicAppBaseUrl || '';
    return {
      ...row,
      id: Number(row.id),
      user_id: Number(row.user_id),
      source_project_id: row.source_project_id == null ? null : Number(row.source_project_id),
      source_entity_id: row.source_entity_id == null ? null : Number(row.source_entity_id),
      file_url: resolveUrl(this.app, row.file_url || '', base),
      preview_url: resolveUrl(this.app, row.preview_url || '', base),
    };
  }

  mapVersion(row) {
    const base = this.app.config.storyboard.publicAppBaseUrl || '';
    return {
      ...row,
      id: Number(row.id),
      entity_id: Number(row.entity_id),
      is_current: Boolean(row.is_current),
      file_url: resolveUrl(this.app, row.file_url || '', base),
      preview_url: resolveUrl(this.app, row.preview_url || '', base),
    };
  }

  mapVoiceVersion(row) {
    return {
      ...row,
      id: Number(row.id),
      character_id: Number(row.character_id),
      duration: Number(row.duration || 0),
      is_current: Boolean(row.is_current),
      file_url: resolveUrl(
        this.app,
        row.file_url || '',
        this.app.config.storyboard.publicAppBaseUrl || '',
      ),
    };
  }

  deriveRequirementStatus(currentStatus, hasMedia) {
    if (currentStatus === 'generating' || currentStatus === 'failed') {
      return currentStatus;
    }
    if (!hasMedia) {
      return 'pending';
    }
    return currentStatus === 'confirmed' ? 'confirmed' : 'generated';
  }

  async queryRequirements(projectId, chapterId) {
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

  async insertLegacyVersion(conn, project, entityType, entityId, fileUrl, previewUrl) {
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

  async syncAssetRequirements(projectId, chapterId = null) {
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
          kind: 'character',
          name: character.name,
          description: character.description || '',
          entityType: 'character',
          entityId: Number(character.id),
          sourceCount: Number(character.source_count || 1),
          fileUrl,
          previewUrl: character.avatar_url || fileUrl,
        });
        await this.insertLegacyVersion(
          conn,
          projects[0],
          'character',
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
          kind: 'scene',
          name: scene.name,
          description: scene.description || '',
          entityType: 'asset',
          entityId: assetId,
          sourceCount: Number(scene.source_count || 1),
          fileUrl,
          previewUrl: assetRows[0]?.thumbnail_url || fileUrl,
        });
        await this.insertLegacyVersion(
          conn,
          projects[0],
          'asset',
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
      const appendProp = (row, sourceCount) => {
        const key = `${row.chapter_id}:${row.id}`;
        if (propExpectedKeys.has(key)) return;
        propExpectedKeys.add(key);
        expected.push({
          chapterId: Number(row.chapter_id),
          kind: 'prop',
          name: row.name,
          description: this.ctx.service.asset.normalizeMetaForApi(row.meta),
          entityType: 'asset',
          entityId: Number(row.id),
          sourceCount: Number(sourceCount || 1),
          fileUrl: row.cover_url || row.file_url || '',
          previewUrl: row.thumbnail_url || row.cover_url || row.file_url || '',
        });
      };
      for (const prop of usedProps) {
        if (/(prop|道具)/i.test(String(prop.type || ''))) appendProp(prop, prop.source_count);
      }

      for (const requirement of existingRequirements.filter((item) => item.kind === 'prop')) {
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
              type: 'prop',
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
            rows.findIndex((row) => Number(row.id) === Number(candidate.id)) === index,
        );
        const current = candidates[0];
        const hasMedia = Boolean(item.fileUrl);
        const status = this.deriveRequirementStatus(current?.status, hasMedia);
        const errorMessage = status === 'failed' ? current?.error_message || null : null;
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
        .filter((item) => !retainedIds.has(Number(item.id)))
        .map((item) => Number(item.id));
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

  async listRequirements(projectId, chapterId) {
    await this.syncAssetRequirements(projectId, chapterId);
    const rows = await this.queryRequirements(projectId, chapterId);
    const base = this.app.config.storyboard.publicAppBaseUrl || '';
    return rows.map((row) => {
      const isCharacter = row.linked_entity_type === 'character';
      const canGenerate = !isCharacter || Boolean(row.character_avatar_url);
      return {
        ...row,
        id: Number(row.id),
        project_id: Number(row.project_id),
        chapter_id: Number(row.chapter_id),
        linked_entity_id: row.linked_entity_id == null ? null : Number(row.linked_entity_id),
        file_url: resolveUrl(this.app, row.file_url || '', base),
        preview_url: resolveUrl(this.app, row.preview_url || '', base),
        can_generate: canGenerate,
        blocking_reason: canGenerate ? '' : '缺少角色参考图，请先到项目资产库补充',
      };
    });
  }

  async listPersonal(userId, kind) {
    const params = [userId];
    const kindFilter = kind ? ' AND kind = ?' : '';
    if (kind) params.push(kind);
    const [rows] = await this.pool.query(
      `SELECT * FROM personal_assets WHERE user_id = ? AND deleted_at IS NULL${kindFilter}
       ORDER BY updated_at DESC`,
      params,
    );
    return rows.map((row) => this.mapPersonal(row));
  }

  async savePersonal(userId, payload) {
    const kind = String(payload.kind || '').trim();
    const name = String(payload.name || '').trim();
    if (!VALID_KINDS.has(kind)) throw new Error('不支持的个人资产类型');
    if (!name) throw new Error('资产名称不能为空');
    const sourceType = payload.source_entity_type || null;
    const sourceId = payload.source_entity_id || null;
    const [existing] = sourceType && sourceId
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
        [kind, name, String(payload.description || ''),
          normalizeGeneratedAssetReference(this.app, String(payload.file_url || '')),
          normalizeGeneratedAssetReference(this.app, String(payload.preview_url || '')),
          payload.metadata_json ? JSON.stringify(payload.metadata_json) : null,
          payload.source_project_id || null, existing[0].id],
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

  async saveCharacterToPersonal(characterId, userId) {
    const character = await this.ctx.service.character.findById(characterId);
    if (!character) throw new Error('character not found');
    await this.ensureOwnedProject(character.project_id, userId);
    return await this.savePersonal(userId, {
      kind: 'character',
      name: character.name,
      description: character.description,
      file_url: character.design_sheet_url || character.avatar_url,
      preview_url: character.avatar_url || character.design_sheet_url,
      source_project_id: character.project_id,
      source_entity_type: 'character',
      source_entity_id: character.id,
    });
  }

  async saveAssetToPersonal(assetId, userId) {
    const asset = await this.ctx.service.asset.findById(assetId);
    if (!asset) throw new Error('asset not found');
    await this.ensureOwnedProject(asset.project_id, userId);
    return await this.savePersonal(userId, {
      kind: asset.type === 'prop' ? 'prop' : 'scene',
      name: asset.name,
      description: asset.meta,
      file_url: asset.cover_url || asset.file_url,
      preview_url: asset.thumbnail_url || asset.cover_url,
      source_project_id: asset.project_id,
      source_entity_type: 'asset',
      source_entity_id: asset.id,
    });
  }

  async importPersonal(personalAssetId, projectId, userId, requirementId) {
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
    if (item.kind === 'character') {
      if (requirement && requirement.kind !== 'character') throw new Error('个人资产类型与需求不匹配');
      const character = requirement?.linked_entity_type === 'character' && requirement.linked_entity_id
        ? await this.ctx.service.character.update(requirement.linked_entity_id, {
            name: item.name, description: item.description,
            avatar_url: item.preview_url || item.file_url, design_sheet_url: item.file_url,
          })
        : await this.ctx.service.character.create(projectId, {
            name: item.name, description: item.description,
            avatar_url: item.preview_url || item.file_url, design_sheet_url: item.file_url,
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
        entity_type: 'character',
        entity: await this.ctx.service.character.findById(character.id),
      };
    }
    if (requirement && requirement.kind !== item.kind) throw new Error('个人资产类型与需求不匹配');
    const asset = requirement?.linked_entity_type === 'asset' && requirement.linked_entity_id
      ? await this.ctx.service.asset.update(requirement.linked_entity_id, {
          name: item.name, type: item.kind === 'prop' ? 'prop' : 'scene',
          file_url: item.file_url, meta: item.description,
        })
      : await this.ctx.service.asset.create(projectId, {
          name: item.name, type: item.kind === 'prop' ? 'prop' : 'scene',
          file_url: item.file_url, meta: item.description,
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
    return { entity_type: 'asset', entity: await this.ctx.service.asset.findById(asset.id) };
  }

  async recordVersion(
    entityType,
    entityId,
    projectId,
    fileUrl,
    previewUrl,
    prompt,
    sourceType = 'generated',
  ) {
    const [projects] = await this.pool.query('SELECT user_id FROM projects WHERE id = ?', [
      projectId,
    ]);
    const userId = Number(projects[0]?.user_id || 0);
    if (!userId || !fileUrl) return null;
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(
        'UPDATE asset_versions SET is_current = 0 WHERE entity_type = ? AND entity_id = ? AND deleted_at IS NULL',
        [entityType, entityId],
      );
      const [result] = await conn.execute(
      `INSERT INTO asset_versions
       (owner_user_id, scope_type, entity_type, entity_id, file_url, preview_url, model, prompt, status, is_current, source_type)
       VALUES (?, 'project', ?, ?, ?, ?, 'seedream-4.5', ?, 'succeeded', 1, ?)`,
      [
        userId,
        entityType,
        entityId,
        normalizeGeneratedAssetReference(this.app, fileUrl),
        normalizeGeneratedAssetReference(this.app, previewUrl || ''),
        prompt || '',
        sourceType,
      ],
    );
      await conn.execute(
      `UPDATE asset_requirements SET status = 'generated', error_message = NULL
       WHERE linked_entity_type = ? AND linked_entity_id = ? AND deleted_at IS NULL`,
      [entityType, entityId],
    );
      await conn.commit();
      return result.insertId;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async listVersions(entityType, entityId) {
    const [rows] = await this.pool.query(
      `SELECT * FROM asset_versions
       WHERE entity_type = ? AND entity_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
      [entityType, entityId],
    );
    return rows.map((row) => this.mapVersion(row));
  }

  async recordVoiceVersion(character, details) {
    const [projects] = await this.pool.query('SELECT user_id FROM projects WHERE id = ?', [
      character.project_id,
    ]);
    const userId = Number(projects[0]?.user_id || 0);
    if (!userId || !character.voice_reference_url) return null;
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(
        'UPDATE character_voice_versions SET is_current = 0 WHERE character_id = ? AND deleted_at IS NULL',
        [character.id],
      );
      const [result] = await conn.execute(
        `INSERT INTO character_voice_versions
         (owner_user_id, character_id, file_url, duration, voice_name, user_prompt,
          effective_prompt, reference_text, source_type, status, is_current)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'succeeded', 1)`,
        [userId, character.id,
          normalizeGeneratedAssetReference(this.app, character.voice_reference_url),
          character.voice_reference_duration || null, character.voice_name || '',
          details.userPrompt || '', details.effectivePrompt || '',
          character.voice_reference_text || '', details.sourceType || 'generated'],
      );
      await conn.commit();
      return result.insertId;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async listVoiceVersions(characterId) {
    const [rows] = await this.pool.query(
      `SELECT * FROM character_voice_versions
       WHERE character_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
      [characterId],
    );
    return rows.map((row) => this.mapVoiceVersion(row));
  }

  async setCurrentVoiceVersion(characterId, versionId, userId) {
    const [rows] = await this.pool.query(
      `SELECT cv.*, p.user_id FROM character_voice_versions cv
       JOIN characters c ON c.id = cv.character_id
       JOIN projects p ON p.id = c.project_id
       WHERE cv.id = ? AND cv.character_id = ? AND cv.deleted_at IS NULL`,
      [versionId, characterId],
    );
    if (!rows.length || Number(rows[0].user_id) !== Number(userId)) {
      throw new Error('语音版本不存在');
    }
    const version = rows[0];
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(
        'UPDATE character_voice_versions SET is_current = 0 WHERE character_id = ?',
        [characterId],
      );
      await conn.execute('UPDATE character_voice_versions SET is_current = 1 WHERE id = ?', [
        versionId,
      ]);
      await conn.execute(
        `UPDATE characters SET voice_reference_url = ?, voice_reference_duration = ?,
         voice_reference_text = ?, voice_name = ?, voice_prompt = ?,
         voice_reference_status = 'succeeded', voice_reference_error = NULL WHERE id = ?`,
        [version.file_url, version.duration, version.reference_text || '', version.voice_name || '',
          version.user_prompt || '', characterId],
      );
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
    return await this.listVoiceVersions(characterId);
  }

  async setCurrentVersion(entityType, entityId, versionId, userId) {
    const [versions] = await this.pool.query(
      `SELECT av.*, p.user_id FROM asset_versions av
       JOIN ${entityType === 'character' ? 'characters' : 'assets'} e ON e.id = av.entity_id
       JOIN projects p ON p.id = e.project_id
       WHERE av.id = ? AND av.entity_type = ? AND av.entity_id = ? AND av.deleted_at IS NULL`,
      [versionId, entityType, entityId],
    );
    if (!versions.length || Number(versions[0].user_id) !== Number(userId))
      throw new Error('版本不存在');
    const version = versions[0];
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(
        'UPDATE asset_versions SET is_current = 0 WHERE entity_type = ? AND entity_id = ?',
        [entityType, entityId],
      );
      await conn.execute('UPDATE asset_versions SET is_current = 1 WHERE id = ?', [versionId]);
      if (entityType === 'character') {
        await conn.execute(
          "UPDATE characters SET design_sheet_url = ?, design_sheet_status = 'succeeded', design_sheet_error = NULL WHERE id = ?",
          [version.file_url, entityId],
        );
      } else {
        await conn.execute(
          "UPDATE assets SET cover_url = ?, thumbnail_url = ?, cover_status = 'succeeded', cover_error = NULL WHERE id = ?",
          [version.file_url, version.preview_url || '', entityId],
        );
      }
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
    return await this.listVersions(entityType, entityId);
  }

  async confirmRequirement(id) {
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
      (item) => item.id === Number(id),
    );
  }

  async generateRequirements(projectId, chapterId, requirementId) {
    const requirements = (await this.listRequirements(projectId, chapterId)).filter((item) =>
      requirementId
        ? item.id === Number(requirementId) && item.status !== 'generating'
        : item.status === 'pending' || item.status === 'failed',
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
          results.push({ id: item.id, status: 'generated', reused: true });
          continue;
        }
        await this.pool.execute(
          "UPDATE asset_requirements SET status = 'generating', error_message = NULL WHERE id = ?",
          [item.id],
        );
        if (item.linked_entity_type === 'character') {
          await this.ctx.service.character.generateDesignSheet(item.linked_entity_id);
        } else {
          await this.ctx.service.asset.generateCover(item.linked_entity_id);
        }
        generatedEntities.add(entityKey);
        results.push({ id: item.id, status: 'generated' });
      } catch (error) {
        this.ctx.logger.error(
          '[asset-workspace] requirement generation failed: project=%s requirement=%s entity=%s:%s error=%s',
          projectId,
          item.id,
          item.linked_entity_type,
          item.linked_entity_id,
          error?.stack || error?.message || error,
        );
        await this.pool.execute(
          "UPDATE asset_requirements SET status = 'failed', error_message = ? WHERE id = ?",
          [error.message || '生成失败', item.id],
        );
        results.push({ id: item.id, status: 'failed', error: error.message || '生成失败' });
      }
    }
    return results;
  }
}

module.exports = AssetWorkspaceService;
