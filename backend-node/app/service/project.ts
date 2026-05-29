'use strict';
// @ts-nocheck

const { Service } = require('egg');
const { mapProject, mapProjectWithStats } = require('../lib/project');
const { composeVideos, sanitizeFileName } = require('../lib/media');
const { hasOwn } = require('../lib/common');

const EMPTY_MEDIA_FIELDS = [ '', '', 'generating', '', 0 ];
const FAILED_MEDIA_PREFIX = [ '', '', 'failed' ];

class ProjectService extends Service {
  get pool() {
    return this.app.mysqlPool;
  }

  /**
   * 读取所有有效项目，并附带项目看板需要的统计字段。
   * @returns {Promise<Array>} 项目列表，例如 `[{ id: 19, chapter_count: 2, scene_count: 8 }]`。
   * @example
   * await service.findAll()
   * // => [{ id: 19, name: "便利店门口", chapter_count: 2, scene_count: 8, storyboard_count: 24 }]
   */
  async findAll() {
    const [ rows ] = await this.pool.query(
      `SELECT
        p.id,
        p.name,
        p.description,
        p.script_text,
        p.video_url,
        p.video_preview_url,
        p.video_status,
        p.video_error,
        p.video_duration,
        p.pinned_at,
        p.created_at,
        p.updated_at,
        (
          SELECT COUNT(*)
          FROM chapters c
          WHERE c.project_id = p.id AND c.deleted_at IS NULL
        ) AS chapter_count,
        (
          SELECT COUNT(*)
          FROM scenes s
          WHERE s.project_id = p.id AND s.deleted_at IS NULL
        ) AS scene_count,
        (
          SELECT COUNT(*)
          FROM storyboards sb
          WHERE sb.project_id = p.id AND sb.deleted_at IS NULL
        ) AS storyboard_count
      FROM projects p
      WHERE p.deleted_at IS NULL
      ORDER BY CASE WHEN p.pinned_at IS NULL THEN 1 ELSE 0 END, p.pinned_at DESC, p.created_at DESC`
    );

    return rows.map((row: Record<string, unknown>) => mapProjectWithStats(this.app, row));
  }

  /**
   * 按 id 读取单个有效项目。
   * @param {number} id 项目 id，例如 `19`。
   * @returns {Promise<object|null>} 项目对象，不存在时返回 `null`。
   * @example
   * await service.findById(19)
   * // => { id: 19, name: "便利店门口", description: "", video_status: "succeeded" }
   */
  async findById(id: number) {
    const [ rows ] = await this.pool.query(
      `SELECT
        id,
        name,
        description,
        script_text,
        video_url,
        video_preview_url,
        video_status,
        video_error,
        video_duration,
        pinned_at,
        created_at,
        updated_at
      FROM projects
      WHERE id = ? AND deleted_at IS NULL`,
      [ id ]
    );

    if (!rows.length) {
      return null;
    }

    return mapProject(this.app, rows[0]);
  }

  /**
   * 检查当前是否已有同名有效项目。
   * @param {string} name 项目名，例如 `"便利店门口"`。
   * @returns {Promise<object|null>} 最小项目行，不存在时返回 `null`。
   * @example
   * await service.findByName("便利店门口")
   * // => { id: 19 }
   */
  async findByName(name: string) {
    const [ rows ] = await this.pool.query(
      'SELECT id FROM projects WHERE name = ? AND deleted_at IS NULL LIMIT 1',
      [ name ]
    );
    return rows[0] || null;
  }

  /**
   * 更新项目名称时，排除当前项目后检查是否重名。
   * @param {string} name 项目名，例如 `"便利店门口"`。
   * @param {number} id 当前项目 id，例如 `19`。
   * @returns {Promise<object|null>} 最小项目行，不存在时返回 `null`。
   * @example
   * await service.findByNameExceptId("便利店门口", 19)
   * // => null
   */
  async findByNameExceptId(name: string, id: number) {
    const [ rows ] = await this.pool.query(
      'SELECT id FROM projects WHERE name = ? AND id <> ? AND deleted_at IS NULL LIMIT 1',
      [ name, id ]
    );
    return rows[0] || null;
  }

  /**
   * 创建一个新项目壳，用于后续导入脚本或手工编辑。
   * @param {Record<string, unknown>} payload 输入数据，例如 `{ name: "新项目", description: "古风漫剧" }`。
   * @returns {Promise<object>} 新建后的项目对象。
   * @example
   * await service.create({ name: "新项目", description: "古风漫剧" })
   * // => { id: 30, name: "新项目", description: "古风漫剧" }
   */
  async create(payload: Record<string, unknown>) {
    const name = String(payload.name || '').trim();
    if (!name) {
      throw new Error('项目名称不能为空');
    }

    const existing = await this.findByName(name);
    if (existing) {
      throw new Error('项目名称已存在，请更换名称');
    }

    const [ result ] = await this.pool.execute(
      'INSERT INTO projects (name, description, script_text) VALUES (?, ?, ?)',
      [ name, String(payload.description || ''), '' ]
    );

    return await this.findById(result.insertId);
  }

  /**
   * 更新项目可编辑字段，例如名称、说明和脚本文本。
   * @param {number} id 项目 id，例如 `19`。
   * @param {Record<string, unknown>} payload 局部补丁，例如 `{ description: "修订后的项目说明" }`。
   * @returns {Promise<object>} 更新后的项目对象。
   * @example
   * await service.update(19, { description: "修订后的项目说明" })
   * // => { id: 19, description: "修订后的项目说明" }
   */
  async update(id: number, payload: Record<string, unknown>) {
    const current = await this.findById(id);
    if (!current) {
      throw new Error('project not found');
    }

    let nextName = current.name;
    if (hasOwn(payload, 'name')) {
      nextName = String(payload.name || '').trim();
      if (!nextName) {
        throw new Error('项目名称不能为空');
      }

      const existing = await this.findByNameExceptId(nextName, id);
      if (existing) {
        throw new Error('项目名称已存在，请更换名称');
      }
    }

    const nextDescription = hasOwn(payload, 'description')
      ? String(payload.description || '')
      : current.description;
    const nextScriptText = hasOwn(payload, 'script_text')
      ? String(payload.script_text || '')
      : current.script_text;

    await this.pool.execute(
      'UPDATE projects SET name = ?, description = ?, script_text = ? WHERE id = ?',
      [ nextName, nextDescription, nextScriptText, id ]
    );

    return await this.findById(id);
  }

  /**
   * 软删除项目。
   * @param {number} id 项目 id，例如 `19`。
   * @returns {Promise<void>} 写入删除标记后返回。
   * @example
   * await service.softDelete(19)
   * // => void
   */
  async softDelete(id: number) {
    await this.pool.execute('UPDATE projects SET deleted_at = NOW() WHERE id = ?', [ id ]);
  }

  /**
   * 将项目置顶到看板顶部。
   * @param {number} id 项目 id，例如 `19`。
   * @returns {Promise<object>} 更新后的项目对象，包含 `pinned_at`。
   * @example
   * await service.pin(19)
   * // => { id: 19, pinned_at: "2026-05-29T03:00:00.000Z" }
   */
  async pin(id: number) {
    const current = await this.findById(id);
    if (!current) {
      throw new Error('project not found');
    }

    await this.pool.execute(
      'UPDATE projects SET pinned_at = NOW() WHERE id = ? AND deleted_at IS NULL',
      [ id ]
    );
    return await this.findById(id);
  }

  /**
   * 取消项目置顶。
   * @param {number} id 项目 id，例如 `19`。
   * @returns {Promise<object>} 更新后的项目对象，`pinned_at = null`。
   * @example
   * await service.unpin(19)
   * // => { id: 19, pinned_at: null }
   */
  async unpin(id: number) {
    const current = await this.findById(id);
    if (!current) {
      throw new Error('project not found');
    }

    await this.pool.execute(
      'UPDATE projects SET pinned_at = NULL WHERE id = ? AND deleted_at IS NULL',
      [ id ]
    );
    return await this.findById(id);
  }

  /**
   * 按章节和场景顺序，把所有成功的场景视频合成为项目总片。
   * @param {number} id 项目 id，例如 `19`。
   * @param {boolean} regenerate 已有项目视频时，是否强制重新合成。
   * @returns {Promise<object>} 更新后的项目对象，包含 `video_url`、`video_status` 和时长。
   * @example
   * await service.composeVideo(19, true)
   * // => { id: 19, video_url: "/generated/project-videos/project-19-....mp4", video_status: "succeeded" }
   */
  async composeVideo(id: number, regenerate: boolean) {
    const project = await this.findById(id);
    if (!project) {
      throw new Error('project not found');
    }
    if (!regenerate && project.video_url) {
      return project;
    }
    const [ chapters ] = await this.pool.query(
      'SELECT id, sort_order FROM chapters WHERE project_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC, id ASC',
      [ id ]
    );
    const inputs: string[] = [];
    for (const chapter of chapters) {
      const [ scenes ] = await this.pool.query(
        `SELECT id, video_url, video_status, video_duration, sort_order
         FROM scenes
         WHERE chapter_id = ? AND deleted_at IS NULL
         ORDER BY sort_order ASC, id ASC`,
        [ chapter.id ]
      );
      for (const scene of scenes) {
        if (scene.video_status === 'succeeded' && scene.video_url) {
          inputs.push(String(scene.video_url));
        }
      }
    }
    if (!inputs.length) {
      throw new Error('当前项目没有可合成的场景视频');
    }
    await this.pool.execute(
      'UPDATE projects SET video_url = ?, video_preview_url = ?, video_status = ?, video_error = ?, video_duration = ? WHERE id = ?',
      [ ...EMPTY_MEDIA_FIELDS, id ]
    );
    try {
      const filename = `${sanitizeFileName(`project-${id}`)}-${Date.now()}.mp4`;
      const composed = await composeVideos(this.app, inputs, 'project-videos', filename);
      await this.pool.execute(
        'UPDATE projects SET video_url = ?, video_preview_url = ?, video_status = ?, video_error = ?, video_duration = ? WHERE id = ?',
        [ composed.publicPath, composed.previewPath, 'succeeded', '', composed.duration, id ]
      );
      return await this.findById(id);
    } catch (error: any) {
      await this.pool.execute(
        'UPDATE projects SET video_url = ?, video_preview_url = ?, video_status = ?, video_error = ?, video_duration = ? WHERE id = ?',
        [ ...FAILED_MEDIA_PREFIX, error.message, 0, id ]
      );
      throw error;
    }
  }
}

module.exports = ProjectService;
