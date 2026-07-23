'use strict';
// @ts-nocheck

const Service = require('egg').Service;
const { normalizeGeneratedAssetReference, resolveUrl } = require('../lib/generated_asset');
const { serializeMediaGenerationMeta } = require('../lib/media_generation_meta');

class SceneMediaGenerationService extends Service {
  get pool() {
    return this.app.mysqlPool;
  }

  map(row) {
    const baseUrl = this.app.config.storyboard.publicAppBaseUrl || '';
    return {
      id: Number(row.id),
      scene_id: Number(row.scene_id),
      legacy_storyboard_id: row.legacy_storyboard_id ? Number(row.legacy_storyboard_id) : null,
      media_type: row.media_type,
      model: row.model,
      status: row.status,
      result_url: resolveUrl(this.app, row.result_url || '', baseUrl),
      preview_url: resolveUrl(this.app, row.preview_url || '', baseUrl),
      poster_url: resolveUrl(this.app, row.poster_url || '', baseUrl),
      source_url: resolveUrl(this.app, row.source_url || '', baseUrl),
      error_message: row.error_message || '',
      is_current: Boolean(row.is_current),
      meta_json: serializeMediaGenerationMeta(row.meta_json),
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
  }

  async listBySceneId(sceneId) {
    const [rows] = await this.pool.query(
      `SELECT id, scene_id, legacy_storyboard_id, media_type, model, status, result_url,
              preview_url, poster_url, source_url, error_message, is_current, meta_json, created_at, updated_at
       FROM scene_media_generations
       WHERE scene_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC, id DESC`,
      [sceneId],
    );
    return rows.map((row) => this.map(row));
  }

  async findById(id) {
    const [rows] = await this.pool.query(
      `SELECT id, scene_id, legacy_storyboard_id, media_type, model, status, result_url,
              preview_url, poster_url, source_url, error_message, is_current, meta_json, created_at, updated_at
       FROM scene_media_generations
       WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    return rows.length ? this.map(rows[0]) : null;
  }

  async create(payload) {
    const mediaReference = (value) =>
      value ? normalizeGeneratedAssetReference(this.app, value) : null;
    const [result] = await this.pool.execute(
      `INSERT INTO scene_media_generations
        (scene_id, media_type, model, status, result_url, preview_url, poster_url, source_url,
         error_message, is_current, meta_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(payload.scene_id),
        String(payload.media_type || ''),
        String(payload.model || ''),
        String(payload.status || ''),
        mediaReference(payload.result_url),
        mediaReference(payload.preview_url),
        mediaReference(payload.poster_url),
        mediaReference(payload.source_url),
        payload.error_message || null,
        payload.is_current ? 1 : 0,
        serializeMediaGenerationMeta(payload.meta_json) || null,
      ],
    );
    return await this.findById(result.insertId);
  }

  async update(id, payload) {
    const current = await this.findById(id);
    if (!current) throw new Error('scene media generation not found');
    const value = (key) =>
      Object.prototype.hasOwnProperty.call(payload, key) ? payload[key] : current[key];
    const mediaReference = (key) => {
      const reference = value(key);
      return reference ? normalizeGeneratedAssetReference(this.app, reference) : null;
    };
    await this.pool.execute(
      `UPDATE scene_media_generations
       SET model = ?, status = ?, result_url = ?, preview_url = ?, poster_url = ?, source_url = ?,
           error_message = ?, is_current = ?, meta_json = ?
       WHERE id = ?`,
      [
        value('model') || '',
        value('status') || '',
        mediaReference('result_url'),
        mediaReference('preview_url'),
        mediaReference('poster_url'),
        mediaReference('source_url'),
        value('error_message') || null,
        value('is_current') ? 1 : 0,
        serializeMediaGenerationMeta(value('meta_json')) || null,
        id,
      ],
    );
    return await this.findById(id);
  }

  async markCurrent(sceneId, mediaType, generationId) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(
        'UPDATE scene_media_generations SET is_current = 0 WHERE scene_id = ? AND media_type = ?',
        [sceneId, mediaType],
      );
      await conn.execute(
        `UPDATE scene_media_generations SET is_current = 1
         WHERE id = ? AND scene_id = ? AND media_type = ? AND deleted_at IS NULL`,
        [generationId, sceneId, mediaType],
      );
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async softDelete(id) {
    await this.pool.execute(
      `UPDATE scene_media_generations
       SET deleted_at = NOW(), is_current = 0
       WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
  }
}

module.exports = SceneMediaGenerationService;
