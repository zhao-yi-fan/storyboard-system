'use strict';
// @ts-nocheck

const { Service } = require('egg');
const { mapChapter } = require('../lib/entity');
const { hasOwn, toPositiveNumber } = require('../lib/common');

class ChapterService extends Service {
  get pool() {
    return this.app.mysqlPool;
  }

  /**
   * 在读取或修改章节前，先确认目标项目存在。
   * @param {number} projectId 项目 id，例如 `19`。
   * @returns {Promise<void>} 项目存在时正常返回。
   * @example
   * await service.ensureProjectExists(19)
   * // => void
   */
  async ensureProjectExists(projectId: number) {
    const [ rows ] = await this.pool.query(
      'SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL',
      [ projectId ]
    );
    if (!rows.length) {
      throw new Error('project not found');
    }
  }

  /**
   * 按展示顺序读取项目下的所有可见章节。
   * @param {number} projectId 项目 id，例如 `19`。
   * @returns {Promise<Array>} 章节列表，例如 `[{ id: 11, title: "第1章", sort_order: 1 }]`。
   * @example
   * await service.findByProjectId(19)
   * // => [{ id: 11, project_id: 19, title: "第1章", summary: "", sort_order: 1 }]
   */
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

  /**
   * 按 id 读取单个章节。
   * @param {number} id 章节 id，例如 `11`。
   * @returns {Promise<object|null>} 章节对象，不存在时返回 `null`。
   * @example
   * await service.findById(11)
   * // => { id: 11, project_id: 19, title: "第1章", summary: "", sort_order: 1 }
   */
  async findById(id: number) {
    const [ rows ] = await this.pool.query(
      `SELECT id, project_id, title, summary, sort_order, created_at, updated_at
       FROM chapters
       WHERE id = ? AND deleted_at IS NULL`,
      [ id ]
    );
    return rows.length ? mapChapter(rows[0]) : null;
  }

  /**
   * 读取当前最大排序值，供新章节追加到末尾。
   * @param {number} projectId 项目 id，例如 `19`。
   * @returns {Promise<number>} 当前最大排序值，例如 `3`。
   * @example
   * await service.getMaxSortOrder(19)
   * // => 3
   */
  async getMaxSortOrder(projectId: number) {
    const [ rows ] = await this.pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM chapters WHERE project_id = ? AND deleted_at IS NULL',
      [ projectId ]
    );
    return Number(rows[0]?.max_sort || 0);
  }

  /**
   * 在目标项目下创建一个新章节。
   * @param {number} projectId 项目 id，例如 `19`。
   * @param {Record<string, unknown>} payload 输入数据，例如 `{ title: "第2章", summary: "夜戏开始" }`。
   * @returns {Promise<object>} 新建后的章节对象。
   * @example
   * await service.create(19, { title: "第2章", summary: "夜戏开始" })
   * // => { id: 12, project_id: 19, title: "第2章", summary: "夜戏开始", sort_order: 2 }
   */
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

  /**
   * 更新章节文案和排序字段。
   * @param {number} id 章节 id，例如 `12`。
   * @param {Record<string, unknown>} payload 局部补丁，例如 `{ title: "第2章（修订）", sort_order: 1 }`。
   * @returns {Promise<object>} 更新后的章节对象。
   * @example
   * await service.update(12, { title: "第2章（修订）" })
   * // => { id: 12, title: "第2章（修订）", sort_order: 2 }
   */
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

  /**
   * 软删除章节，不直接物理删库。
   * @param {number} id 章节 id，例如 `12`。
   * @returns {Promise<void>} 写入 `deleted_at` 后返回。
   * @example
   * await service.softDelete(12)
   * // => void
   */
  async softDelete(id: number) {
    await this.pool.execute('UPDATE chapters SET deleted_at = NOW() WHERE id = ?', [ id ]);
  }
}

module.exports = ChapterService;
