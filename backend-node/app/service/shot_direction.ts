'use strict';
// @ts-nocheck

const Service = require('egg').Service;
const { buildShotDirectionGraph } = require('../lib/shot_direction_graph');

const ANALYSIS_NOTE_MARKER = '镜头走向建议：';

function parseResultJson(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function cleanString(value) {
  return String(value || '').trim();
}

function buildAnalysisNotes(result) {
  const lines = [
    `${ANALYSIS_NOTE_MARKER}`,
    result.narrative_role ? `- 叙事功能：${result.narrative_role}` : '',
    result.emotional_shift ? `- 情绪推进：${result.emotional_shift}` : '',
    result.continuity_from_previous ? `- 前镜承接：${result.continuity_from_previous}` : '',
    result.continuity_to_next ? `- 后镜引出：${result.continuity_to_next}` : '',
  ].filter(Boolean);
  const risks = Array.isArray(result.risk_flags) ? result.risk_flags.filter(Boolean) : [];
  if (risks.length) {
    lines.push(`- 风险提示：${risks.join('；')}`);
  }
  return lines.join('\n');
}

function mergeAnalysisNotes(currentNotes, result) {
  const existing = cleanString(currentNotes);
  const markerIndex = existing.indexOf(ANALYSIS_NOTE_MARKER);
  const base = markerIndex >= 0 ? existing.slice(0, markerIndex).trim() : existing;
  return [ base, buildAnalysisNotes(result) ].filter(Boolean).join('\n\n');
}

class ShotDirectionService extends Service {
  get pool() {
    return this.app.mysqlPool;
  }

  map(row) {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      scene_id: Number(row.scene_id),
      storyboard_id: Number(row.storyboard_id),
      status: row.status,
      result_json: parseResultJson(row.result_json),
      error_message: row.error_message || '',
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
  }

  async listBySceneId(sceneId) {
    const [ rows ] = await this.pool.query(
      `SELECT sda.id, sda.project_id, sda.scene_id, sda.storyboard_id, sda.status, sda.result_json,
              sda.error_message, sda.created_at, sda.updated_at
       FROM storyboard_direction_analyses sda
       JOIN (
         SELECT storyboard_id, MAX(id) AS id
         FROM storyboard_direction_analyses
         WHERE scene_id = ? AND deleted_at IS NULL
         GROUP BY storyboard_id
       ) latest ON latest.id = sda.id
       JOIN storyboards sb ON sb.id = sda.storyboard_id
       WHERE sda.scene_id = ? AND sda.deleted_at IS NULL AND sb.deleted_at IS NULL
       ORDER BY sb.sort_order ASC, sb.id ASC, sda.id ASC`,
      [ sceneId, sceneId ]
    );
    return rows.map(row => this.map(row));
  }

  async findLatestByStoryboardId(storyboardId) {
    const [ rows ] = await this.pool.query(
      `SELECT id, project_id, scene_id, storyboard_id, status, result_json, error_message, created_at, updated_at
       FROM storyboard_direction_analyses
       WHERE storyboard_id = ? AND deleted_at IS NULL
       ORDER BY id DESC
       LIMIT 1`,
      [ storyboardId ]
    );
    return rows.length ? this.map(rows[0]) : null;
  }

  async replaceWithAnalyzingRows(scene, storyboards) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(
        'UPDATE storyboard_direction_analyses SET deleted_at = NOW() WHERE scene_id = ? AND deleted_at IS NULL',
        [ Number(scene.id) ]
      );
      for (const storyboard of storyboards) {
        await conn.execute(
          `INSERT INTO storyboard_direction_analyses
            (project_id, scene_id, storyboard_id, status, result_json, error_message)
           VALUES (?, ?, ?, 'analyzing', NULL, NULL)`,
          [ Number(scene.project_id), Number(scene.id), Number(storyboard.id) ]
        );
      }
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async persistSucceeded(sceneId, analyses) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const analysis of analyses) {
        await conn.execute(
          `UPDATE storyboard_direction_analyses
           SET status = 'succeeded', result_json = ?, error_message = NULL
           WHERE scene_id = ? AND storyboard_id = ? AND deleted_at IS NULL`,
          [ JSON.stringify(analysis), Number(sceneId), Number(analysis.storyboard_id) ]
        );
      }
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async markSceneFailed(sceneId, message) {
    await this.pool.execute(
      `UPDATE storyboard_direction_analyses
       SET status = 'failed', error_message = ?
       WHERE scene_id = ? AND deleted_at IS NULL AND status IN ('pending', 'analyzing')`,
      [ cleanString(message) || '镜头走向分析失败', Number(sceneId) ]
    );
  }

  async clearScene(sceneId) {
    await this.pool.execute(
      'UPDATE storyboard_direction_analyses SET deleted_at = NOW() WHERE scene_id = ? AND deleted_at IS NULL',
      [ Number(sceneId) ]
    );
  }

  async analyzeScene(sceneId) {
    const scene = await this.ctx.service.scene.findById(sceneId);
    if (!scene) {
      throw new Error('scene not found');
    }

    const storyboards = await this.ctx.service.storyboard.findBySceneId(sceneId);
    if (!storyboards.length) {
      await this.clearScene(scene.id);
      return [];
    }

    await this.replaceWithAnalyzingRows(scene, storyboards);
    const graph = buildShotDirectionGraph({
      config: this.app.config.storyboard || {},
      persistResults: async analyses => {
        await this.persistSucceeded(scene.id, analyses);
      },
    });

    try {
      await graph.invoke({
        scene,
        storyboards,
        analyses: [],
        raw_output: '',
        error_message: '',
      });
      return await this.listBySceneId(scene.id);
    } catch (error) {
      await this.markSceneFailed(scene.id, error.message);
      throw error;
    }
  }

  async applySuggestion(storyboardId, payload: Record<string, unknown> = {}) {
    const storyboard = await this.ctx.service.storyboard.findById(storyboardId);
    if (!storyboard) {
      throw new Error('storyboard not found');
    }

    const analysis = await this.findLatestByStoryboardId(storyboardId);
    if (!analysis || analysis.status !== 'succeeded' || !analysis.result_json) {
      throw new Error('no succeeded shot direction analysis found');
    }

    const result = analysis.result_json;
    const patch: Record<string, unknown> = {};
    if (payload.camera_motion !== false && cleanString(result.camera_motion_suggestion)) {
      patch.camera_motion = cleanString(result.camera_motion_suggestion);
    }
    if (payload.shot_type !== false && cleanString(result.shot_type_suggestion)) {
      patch.shot_type = cleanString(result.shot_type_suggestion);
    }
    if (payload.notes !== false) {
      patch.notes = mergeAnalysisNotes(storyboard.notes, result);
    }
    if (!Object.keys(patch).length) {
      throw new Error('no suggestion fields selected');
    }

    return await this.ctx.service.storyboard.update(storyboardId, patch);
  }
}

module.exports = ShotDirectionService;
