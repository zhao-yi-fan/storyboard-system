'use strict';
// @ts-nocheck

const { Service } = require('egg');
const { mapChapter } = require('../lib/entity');
const { hasOwn, toPositiveNumber } = require('../lib/common');

class ChapterService extends Service {
  get pool() {
    return this.app.mysqlPool;
  }

  async ensureProjectExists(projectId: number) {
    const [ rows ] = await this.pool.query(
      'SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL',
      [ projectId ]
    );
    if (!rows.length) {
      throw new Error('project not found');
    }
  }

  async findByProjectId(projectId: number) {
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

  async findById(id: number) {
    const [ rows ] = await this.pool.query(
      `SELECT id, project_id, title, summary, sort_order, created_at, updated_at
       FROM chapters
       WHERE id = ? AND deleted_at IS NULL`,
      [ id ]
    );
    return rows.length ? mapChapter(rows[0]) : null;
  }

  async getMaxSortOrder(projectId: number) {
    const [ rows ] = await this.pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM chapters WHERE project_id = ? AND deleted_at IS NULL',
      [ projectId ]
    );
    return Number(rows[0]?.max_sort || 0);
  }

  async create(projectId: number, payload: Record<string, unknown>) {
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

  async update(id: number, payload: Record<string, unknown>) {
    const current = await this.findById(id);
    if (!current) {
      throw new Error('chapter not found');
    }

    const title = hasOwn(payload, 'title') && String(payload.title || '').trim()
      ? String(payload.title || '').trim()
      : current.title;
    if (!title) {
      throw new Error('title is required');
    }

    const summary = hasOwn(payload, 'summary')
      ? String(payload.summary || '')
      : current.summary;
    const sortOrder = hasOwn(payload, 'sort_order')
      ? toPositiveNumber(payload.sort_order, current.sort_order)
      : current.sort_order;

    await this.pool.execute(
      'UPDATE chapters SET title = ?, summary = ?, sort_order = ? WHERE id = ?',
      [ title, summary, sortOrder, id ]
    );

    return await this.findById(id);
  }

  async softDelete(id: number) {
    await this.pool.execute('UPDATE chapters SET deleted_at = NOW() WHERE id = ?', [ id ]);
  }
}

module.exports = ChapterService;
