'use strict';

const Service = require('egg').Service;
const { mapProject, mapProjectWithStats } = require('../lib/project');
const { composeVideos, sanitizeFileName } = require('../lib/media');

class ProjectService extends Service {
  get pool() {
    return this.app.mysqlPool;
  }

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

    return rows.map(row => mapProjectWithStats(this.app, row));
  }

  async findById(id) {
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

  async findByName(name) {
    const [ rows ] = await this.pool.query(
      'SELECT id FROM projects WHERE name = ? AND deleted_at IS NULL LIMIT 1',
      [ name ]
    );
    return rows[0] || null;
  }

  async findByNameExceptId(name, id) {
    const [ rows ] = await this.pool.query(
      'SELECT id FROM projects WHERE name = ? AND id <> ? AND deleted_at IS NULL LIMIT 1',
      [ name, id ]
    );
    return rows[0] || null;
  }

  async create(payload) {
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

  async update(id, payload) {
    const current = await this.findById(id);
    if (!current) {
      throw new Error('project not found');
    }

    let nextName = current.name;
    if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
      nextName = String(payload.name || '').trim();
      if (!nextName) {
        throw new Error('项目名称不能为空');
      }

      const existing = await this.findByNameExceptId(nextName, id);
      if (existing) {
        throw new Error('项目名称已存在，请更换名称');
      }
    }

    const nextDescription = Object.prototype.hasOwnProperty.call(payload, 'description')
      ? String(payload.description || '')
      : current.description;
    const nextScriptText = Object.prototype.hasOwnProperty.call(payload, 'script_text')
      ? String(payload.script_text || '')
      : current.script_text;

    await this.pool.execute(
      'UPDATE projects SET name = ?, description = ?, script_text = ? WHERE id = ?',
      [ nextName, nextDescription, nextScriptText, id ]
    );

    return await this.findById(id);
  }

  async softDelete(id) {
    await this.pool.execute('UPDATE projects SET deleted_at = NOW() WHERE id = ?', [ id ]);
  }

  async pin(id) {
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

  async unpin(id) {
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

  async composeVideo(id, regenerate) {
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
    const inputs = [];
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
    await this.pool.execute('UPDATE projects SET video_url = ?, video_preview_url = ?, video_status = ?, video_error = ?, video_duration = ? WHERE id = ?', [ '', '', 'generating', '', 0, id ]);
    try {
      const filename = `${sanitizeFileName(`project-${id}`)}-${Date.now()}.mp4`;
      const composed = await composeVideos(this.app, inputs, 'project-videos', filename);
      await this.pool.execute(
        'UPDATE projects SET video_url = ?, video_preview_url = ?, video_status = ?, video_error = ?, video_duration = ? WHERE id = ?',
        [ composed.publicPath, composed.previewPath, 'succeeded', '', composed.duration, id ]
      );
      return await this.findById(id);
    } catch (error) {
      await this.pool.execute(
        'UPDATE projects SET video_url = ?, video_preview_url = ?, video_status = ?, video_error = ?, video_duration = ? WHERE id = ?',
        [ '', '', 'failed', error.message, 0, id ]
      );
      throw error;
    }
  }
}

module.exports = ProjectService;
