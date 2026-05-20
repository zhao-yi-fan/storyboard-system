'use strict';

const Service = require('egg').Service;
const { resolveUrl } = require('../lib/generated_asset');

class MediaGenerationService extends Service {
  get pool() {
    return this.app.mysqlPool;
  }

  map(row) {
    return {
      id: Number(row.id),
      storyboard_id: Number(row.storyboard_id),
      media_type: row.media_type,
      model: row.model,
      status: row.status,
      result_url: resolveUrl(this.app, row.result_url || '', this.app.config.storyboard.publicAppBaseUrl || ''),
      preview_url: resolveUrl(this.app, row.preview_url || '', this.app.config.storyboard.publicAppBaseUrl || ''),
      source_url: resolveUrl(this.app, row.source_url || '', this.app.config.storyboard.publicAppBaseUrl || ''),
      error_message: row.error_message || '',
      is_current: Boolean(row.is_current),
      meta_json: row.meta_json || '',
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
  }

  async listByStoryboardId(storyboardId) {
    const [ rows ] = await this.pool.query(
      `SELECT id, storyboard_id, media_type, model, status, result_url, preview_url, source_url, error_message, is_current, meta_json, created_at, updated_at
       FROM storyboard_media_generations
       WHERE storyboard_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC, id DESC`,
      [ storyboardId ]
    );
    return rows.map(row => this.map(row));
  }

  async findById(id) {
    const [ rows ] = await this.pool.query(
      `SELECT id, storyboard_id, media_type, model, status, result_url, preview_url, source_url, error_message, is_current, meta_json, created_at, updated_at
       FROM storyboard_media_generations
       WHERE id = ? AND deleted_at IS NULL`,
      [ id ]
    );
    return rows.length ? this.map(rows[0]) : null;
  }

  async markCurrent(storyboardId, mediaType, generationId) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('UPDATE storyboard_media_generations SET is_current = 0 WHERE storyboard_id = ? AND media_type = ?', [ storyboardId, mediaType ]);
      await conn.execute('UPDATE storyboard_media_generations SET is_current = 1 WHERE id = ? AND deleted_at IS NULL', [ generationId ]);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async softDelete(id) {
    await this.pool.execute(
      `UPDATE storyboard_media_generations SET deleted_at = NOW(), is_current = 0 WHERE id = ? AND deleted_at IS NULL`,
      [ id ]
    );
  }

  async create(payload) {
    const [ result ] = await this.pool.execute(
      `INSERT INTO storyboard_media_generations
        (storyboard_id, media_type, model, status, result_url, preview_url, source_url, error_message, is_current, meta_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(payload.storyboard_id),
        String(payload.media_type || '').trim(),
        String(payload.model || '').trim(),
        String(payload.status || '').trim(),
        payload.result_url ? String(payload.result_url) : null,
        payload.preview_url ? String(payload.preview_url) : null,
        payload.source_url ? String(payload.source_url) : null,
        payload.error_message ? String(payload.error_message) : null,
        payload.is_current ? 1 : 0,
        payload.meta_json ? String(payload.meta_json) : null,
      ]
    );
    return await this.findById(result.insertId);
  }

  async update(id, payload) {
    const current = await this.findById(id);
    if (!current) {
      throw new Error('media generation not found');
    }
    await this.pool.execute(
      `UPDATE storyboard_media_generations
       SET model = ?, status = ?, result_url = ?, preview_url = ?, source_url = ?, error_message = ?, is_current = ?, meta_json = ?
       WHERE id = ?`,
      [
        Object.prototype.hasOwnProperty.call(payload, 'model') ? String(payload.model || '') : current.model,
        Object.prototype.hasOwnProperty.call(payload, 'status') ? String(payload.status || '') : current.status,
        Object.prototype.hasOwnProperty.call(payload, 'result_url') ? (payload.result_url ? String(payload.result_url) : null) : (current.result_url || null),
        Object.prototype.hasOwnProperty.call(payload, 'preview_url') ? (payload.preview_url ? String(payload.preview_url) : null) : (current.preview_url || null),
        Object.prototype.hasOwnProperty.call(payload, 'source_url') ? (payload.source_url ? String(payload.source_url) : null) : (current.source_url || null),
        Object.prototype.hasOwnProperty.call(payload, 'error_message') ? (payload.error_message ? String(payload.error_message) : null) : (current.error_message || null),
        Object.prototype.hasOwnProperty.call(payload, 'is_current') ? (payload.is_current ? 1 : 0) : (current.is_current ? 1 : 0),
        Object.prototype.hasOwnProperty.call(payload, 'meta_json') ? (payload.meta_json ? String(payload.meta_json) : null) : (current.meta_json || null),
        id,
      ]
    );
    return await this.findById(id);
  }

  async findLatestSucceeded(storyboardId, mediaType, excludeId = 0) {
    const [ rows ] = await this.pool.query(
      `SELECT id, storyboard_id, media_type, model, status, result_url, preview_url, source_url, error_message, is_current, meta_json, created_at, updated_at
       FROM storyboard_media_generations
       WHERE storyboard_id = ? AND media_type = ? AND deleted_at IS NULL AND status = 'succeeded' AND id <> ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [ storyboardId, mediaType, excludeId ]
    );
    return rows.length ? this.map(rows[0]) : null;
  }
}

module.exports = MediaGenerationService;
