'use strict';

const Service = require('egg').Service;
import type { CharacterEntity, DbRow } from '../lib/entity';
const { normalizeGeneratedAssetReference } = require('../lib/generated_asset');
const { mapAssetVersion, mapCharacterVoiceVersion } = require('../lib/asset_workspace_mapper');
const { ASSET_SOURCE_TYPE, ENTITY_TYPE } = require('../lib/domain_constants');

class AssetVersioningService extends Service {
  get pool() {
    return this.app.mysqlPool;
  }

  mapVersion(row: DbRow) {
    return mapAssetVersion(this.app, row);
  }

  mapVoiceVersion(row: DbRow) {
    return mapCharacterVoiceVersion(this.app, row);
  }

  async recordVersion(
    entityType: string,
    entityId: number,
    projectId: number,
    fileUrl: string,
    previewUrl: string,
    prompt: string,
    sourceType: string = ASSET_SOURCE_TYPE.GENERATED,
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

  async recordCharacterDesignSheetVersion(
    character: CharacterEntity,
    fileUrl: string,
    prompt: string,
  ) {
    const [projects] = await this.pool.query('SELECT user_id FROM projects WHERE id = ?', [
      character.project_id,
    ]);
    const userId = Number(projects[0]?.user_id || 0);
    const nextFileUrl = normalizeGeneratedAssetReference(this.app, fileUrl);
    const previousFileUrl = normalizeGeneratedAssetReference(
      this.app,
      character.design_sheet_url || '',
    );
    const previewUrl = normalizeGeneratedAssetReference(this.app, character.avatar_url || '');
    if (!userId) throw new Error('角色所属项目缺少用户信息，无法保存主设定图版本');
    if (!nextFileUrl) throw new Error('主设定图文件地址为空');

    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const [existingVersions] = await conn.query(
        `SELECT id FROM asset_versions
         WHERE entity_type = 'character' AND entity_id = ? AND deleted_at IS NULL LIMIT 1`,
        [character.id],
      );
      if (!existingVersions.length && previousFileUrl && previousFileUrl !== nextFileUrl) {
        await conn.execute(
          `INSERT INTO asset_versions
           (owner_user_id, scope_type, entity_type, entity_id, file_url, preview_url,
            model, prompt, status, is_current, source_type)
           VALUES (?, 'project', 'character', ?, ?, ?, 'legacy', '', 'succeeded', 0, 'legacy-import')`,
          [userId, character.id, previousFileUrl, previewUrl],
        );
      }
      await conn.execute(
        `UPDATE asset_versions SET is_current = 0
         WHERE entity_type = 'character' AND entity_id = ? AND deleted_at IS NULL`,
        [character.id],
      );
      const [result] = await conn.execute(
        `INSERT INTO asset_versions
         (owner_user_id, scope_type, entity_type, entity_id, file_url, preview_url,
          model, prompt, status, is_current, source_type)
         VALUES (?, 'project', 'character', ?, ?, ?, 'seedream-4.5', ?, 'succeeded', 1, 'generated')`,
        [userId, character.id, nextFileUrl, previewUrl, prompt || ''],
      );
      await conn.execute(
        `UPDATE characters
         SET design_sheet_url = ?, design_sheet_status = 'succeeded', design_sheet_error = NULL
         WHERE id = ? AND deleted_at IS NULL`,
        [nextFileUrl, character.id],
      );
      await conn.execute(
        `UPDATE asset_requirements SET status = 'generated', error_message = NULL
         WHERE linked_entity_type = 'character' AND linked_entity_id = ? AND deleted_at IS NULL`,
        [character.id],
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

  async listVersions(entityType: string, entityId: number) {
    const [rows] = await this.pool.query(
      `SELECT * FROM asset_versions
       WHERE entity_type = ? AND entity_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
      [entityType, entityId],
    );
    return rows.map((row: DbRow) => this.mapVersion(row));
  }

  async recordVoiceVersion(character: CharacterEntity, details: Record<string, unknown>) {
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
        [
          userId,
          character.id,
          normalizeGeneratedAssetReference(this.app, character.voice_reference_url),
          character.voice_reference_duration || null,
          character.voice_name || '',
          details.userPrompt || '',
          details.effectivePrompt || '',
          character.voice_reference_text || '',
          details.sourceType || ASSET_SOURCE_TYPE.GENERATED,
        ],
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

  async listVoiceVersions(characterId: number) {
    const [rows] = await this.pool.query(
      `SELECT * FROM character_voice_versions
       WHERE character_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
      [characterId],
    );
    return rows.map((row: DbRow) => this.mapVoiceVersion(row));
  }

  async setCurrentVoiceVersion(characterId: number, versionId: number, userId: number) {
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
        [
          version.file_url,
          version.duration,
          version.reference_text || '',
          version.voice_name || '',
          version.user_prompt || '',
          characterId,
        ],
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

  async setCurrentVersion(entityType: string, entityId: number, versionId: number, userId: number) {
    const [versions] = await this.pool.query(
      `SELECT av.*, p.user_id FROM asset_versions av
       JOIN ${entityType === ENTITY_TYPE.CHARACTER ? 'characters' : 'assets'} e ON e.id = av.entity_id
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
      if (entityType === ENTITY_TYPE.CHARACTER) {
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
}

module.exports = AssetVersioningService;
