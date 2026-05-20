'use strict';

const Service = require('egg').Service;
const { mapChapter } = require('../lib/entity');

class ChapterService extends Service {
  get pool() {
    return this.app.mysqlPool;
  }

  async ensureProjectExists(projectId) {
    const [ rows ] = await this.pool.query(
      'SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL',
      [ projectId ]
    );
    if (!rows.length) {
      throw new Error('project not found');
    }
  }

  async findByProjectId(projectId) {
    await this.ensureProjectExists(projectId);
    const [ rows ] = await this.pool.query(
      `SELECT id, project_id, title, summary, sort_order, created_at, updated_at
       FROM chapters
       WHERE project_id = ? AND deleted_at IS NULL
       ORDER BY sort_order ASC, id ASC`,
      [ projectId ]
    );
    return rows.map(mapChapter);
  }

  async findById(id) {
    const [ rows ] = await this.pool.query(
      `SELECT id, project_id, title, summary, sort_order, created_at, updated_at
       FROM chapters
       WHERE id = ? AND deleted_at IS NULL`,
      [ id ]
    );
    return rows.length ? mapChapter(rows[0]) : null;
  }

  async getMaxSortOrder(projectId) {
    const [ rows ] = await this.pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM chapters WHERE project_id = ? AND deleted_at IS NULL',
      [ projectId ]
    );
    return Number(rows[0]?.max_sort || 0);
  }

  async create(projectId, payload) {
    await this.ensureProjectExists(projectId);
    const title = String(payload.title || '').trim();
    if (!title) {
      throw new Error('title is required');
    }

    const sortOrder = (await this.getMaxSortOrder(projectId)) + 1;
    const [ result ] = await this.pool.execute(
      'INSERT INTO chapters (project_id, title, summary, sort_order) VALUES (?, ?, ?, ?)',
      [ projectId, title, String(payload.summary || ''), sortOrder ]
    );
    return await this.findById(result.insertId);
  }

  async update(id, payload) {
    const current = await this.findById(id);
    if (!current) {
      throw new Error('chapter not found');
    }

    const title = Object.prototype.hasOwnProperty.call(payload, 'title') && String(payload.title || '').trim()
      ? String(payload.title || '').trim()
      : current.title;
    if (!title) {
      throw new Error('title is required');
    }

    const summary = Object.prototype.hasOwnProperty.call(payload, 'summary')
      ? String(payload.summary || '')
      : current.summary;
    const sortOrder = Object.prototype.hasOwnProperty.call(payload, 'sort_order') && Number(payload.sort_order)
      ? Number(payload.sort_order)
      : current.sort_order;

    await this.pool.execute(
      'UPDATE chapters SET title = ?, summary = ?, sort_order = ? WHERE id = ?',
      [ title, summary, sortOrder, id ]
    );

    return await this.findById(id);
  }

  async softDelete(id) {
    await this.pool.execute('UPDATE chapters SET deleted_at = NOW() WHERE id = ?', [ id ]);
  }
}

module.exports = ChapterService;
