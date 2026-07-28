'use strict';
// @ts-nocheck

const path = require('node:path');
const Service = require('egg').Service;
const { GENERATION_STATUS, MEDIA_TYPE } = require('../lib/domain_constants');
const {
  deleteGeneratedAsset,
  generatedPublicPath,
  resolveUrl,
  uploadBuffer,
} = require('../lib/generated_asset');
const { parseMediaGenerationMeta } = require('../lib/media_generation_meta');

const FRAME_UPLOAD_SPEC = Object.freeze({
  ALLOWED_IMAGE_TYPES: Object.freeze(['image/webp', 'image/jpeg', 'image/png']),
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
});

class SceneVideoFrameService extends Service {
  get pool() {
    return this.app.mysqlPool;
  }

  map(row, targets = []) {
    const baseUrl = this.app.config.storyboard.publicAppBaseUrl || '';
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      source_scene_id: Number(row.source_scene_id),
      source_generation_id: Number(row.source_generation_id),
      source_scene_title: row.source_scene_title || '',
      timestamp_ms: Number(row.timestamp_ms),
      file_url: resolveUrl(this.app, row.file_url || '', baseUrl),
      preview_url: resolveUrl(this.app, row.preview_url || row.file_url || '', baseUrl),
      target_scenes: targets,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    };
  }

  async listByGeneration(sceneId, generationId) {
    const [rows] = await this.pool.query(
      `SELECT f.*, s.title AS source_scene_title
       FROM scene_video_frames f
       JOIN scenes s ON s.id = f.source_scene_id
       WHERE f.source_scene_id = ? AND f.source_generation_id = ? AND f.deleted_at IS NULL
       ORDER BY f.timestamp_ms ASC, f.id ASC`,
      [sceneId, generationId],
    );
    return await this.attachTargets(rows);
  }

  async listByGenerationIds(generationIds) {
    const ids = [...new Set(generationIds.map(Number).filter((id) => id > 0))];
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await this.pool.query(
      `SELECT f.*, s.title AS source_scene_title
       FROM scene_video_frames f
       JOIN scenes s ON s.id = f.source_scene_id
       WHERE f.source_generation_id IN (${placeholders}) AND f.deleted_at IS NULL
       ORDER BY f.timestamp_ms ASC, f.id ASC`,
      ids,
    );
    return await this.attachTargets(rows);
  }

  async listByTargetScene(sceneId) {
    const grouped = await this.listByTargetScenes([sceneId]);
    return grouped.get(Number(sceneId)) || [];
  }

  async listByTargetScenes(sceneIds) {
    const ids = [...new Set(sceneIds.map(Number).filter((id) => id > 0))];
    if (!ids.length) return new Map();
    const [rows] = await this.pool.query(
      `SELECT f.*, source.title AS source_scene_title
              , u.target_scene_id
       FROM scene_video_frames f
       JOIN scene_video_frame_usages u ON u.frame_id = f.id
       JOIN scenes source ON source.id = f.source_scene_id
       WHERE u.target_scene_id IN (${ids.map(() => '?').join(',')})
         AND u.usage_type = 'reference_image'
         AND f.deleted_at IS NULL
       ORDER BY u.created_at ASC, f.id ASC`,
      ids,
    );
    const attached = await this.attachTargets(rows);
    const grouped = new Map();
    attached.forEach((frame, index) => {
      const targetSceneId = Number(rows[index].target_scene_id);
      const items = grouped.get(targetSceneId) || [];
      items.push(frame);
      grouped.set(targetSceneId, items);
    });
    return grouped;
  }

  async attachTargets(rows) {
    if (!rows.length) return [];
    const ids = rows.map((row) => Number(row.id));
    const [usageRows] = await this.pool.query(
      `SELECT u.frame_id, u.usage_type, s.id, s.title
       FROM scene_video_frame_usages u
       JOIN scenes s ON s.id = u.target_scene_id AND s.deleted_at IS NULL
       WHERE u.frame_id IN (${ids.map(() => '?').join(',')})
       ORDER BY s.sort_order ASC, s.id ASC`,
      ids,
    );
    const targetsByFrame = new Map();
    for (const usage of usageRows) {
      const targets = targetsByFrame.get(Number(usage.frame_id)) || [];
      targets.push({
        id: Number(usage.id),
        title: usage.title || '',
        usage_type: usage.usage_type,
      });
      targetsByFrame.set(Number(usage.frame_id), targets);
    }
    return rows.map((row) => this.map(row, targetsByFrame.get(Number(row.id)) || []));
  }

  async attachToGenerations(generations) {
    const frames = await this.listByGenerationIds(generations.map((item) => item.id));
    const byGeneration = new Map();
    for (const frame of frames) {
      const items = byGeneration.get(frame.source_generation_id) || [];
      items.push(frame);
      byGeneration.set(frame.source_generation_id, items);
    }
    return generations.map((item) => ({
      ...item,
      extracted_frames: byGeneration.get(Number(item.id)) || [],
    }));
  }

  async validateSource(sceneId, generationId) {
    const scene = await this.ctx.service.scene.findById(sceneId);
    const generation = await this.ctx.service.sceneMediaGeneration.findById(generationId);
    if (!scene) throw new Error('片段不存在');
    if (!generation || Number(generation.scene_id) !== Number(sceneId)) {
      throw new Error('视频版本不存在');
    }
    if (
      generation.media_type !== MEDIA_TYPE.VIDEO ||
      generation.status !== GENERATION_STATUS.SUCCEEDED ||
      !generation.result_url
    ) {
      throw new Error('只能从生成成功的视频版本抽帧');
    }
    return { scene, generation };
  }

  resolveDurationSeconds(scene, generation) {
    const meta = parseMediaGenerationMeta(generation.meta_json);
    return Number(meta.duration || scene.video_duration || scene.generation_duration || 0);
  }

  async create(sceneId, generationId, payload) {
    const { scene, generation } = await this.validateSource(sceneId, generationId);
    const targetScene = await this.ctx.service.scene.findById(Number(payload.target_scene_id));
    if (!targetScene || Number(targetScene.project_id) !== Number(scene.project_id)) {
      throw new Error('目标片段必须属于同一项目');
    }
    if (Number(targetScene.id) !== Number(scene.id)) {
      const [nextRows] = await this.pool.query(
        `SELECT id FROM scenes
         WHERE chapter_id = ? AND deleted_at IS NULL
           AND (sort_order > ? OR (sort_order = ? AND id > ?))
         ORDER BY sort_order ASC, id ASC LIMIT 1`,
        [scene.chapter_id, scene.sort_order, scene.sort_order, scene.id],
      );
      if (!nextRows.length || Number(nextRows[0].id) !== Number(targetScene.id)) {
        throw new Error('目标只能是本片段或同集下一片段');
      }
    }
    const timestampMs = Math.round(Number(payload.timestamp_ms) / 100) * 100;
    const durationMs = Math.round(this.resolveDurationSeconds(scene, generation) * 1000);
    if (!Number.isInteger(timestampMs) || timestampMs < 0 || durationMs <= 0 || timestampMs > durationMs) {
      throw new Error('抽帧时间点超出视频有效时长');
    }
    const contentType = String(payload.content_type || '').toLowerCase();
    const buffer = payload.buffer;
    if (!FRAME_UPLOAD_SPEC.ALLOWED_IMAGE_TYPES.includes(contentType)) {
      throw new Error('仅支持 WebP、JPEG 或 PNG 图片');
    }
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('抽帧图片不能为空');
    if (buffer.length > FRAME_UPLOAD_SPEC.MAX_FILE_SIZE_BYTES) {
      throw new Error('抽帧图片不能超过 10MB');
    }

    const [existingRows] = await this.pool.query(
      `SELECT f.*, s.title AS source_scene_title
       FROM scene_video_frames f JOIN scenes s ON s.id = f.source_scene_id
       WHERE f.source_generation_id = ? AND f.timestamp_ms = ? LIMIT 1`,
      [generationId, timestampMs],
    );
    if (existingRows.length && !existingRows[0].deleted_at) {
      await this.pool.execute(
        'UPDATE scene_video_frames SET deleted_at = NULL WHERE id = ?',
        [existingRows[0].id],
      );
      await this.bind(existingRows[0].id, targetScene.id);
      return (await this.listByGeneration(sceneId, generationId)).find(
        (item) => item.id === Number(existingRows[0].id),
      );
    }

    const extension = contentType === 'image/png' ? '.png' : contentType === 'image/jpeg' ? '.jpg' : '.webp';
    const fileName = `scene-${sceneId}-video-${generationId}-${timestampMs}-${Date.now()}${extension}`;
    const publicPath = generatedPublicPath(this.app, 'video-frames', path.posix.basename(fileName));
    await uploadBuffer(this.app, buffer, publicPath);

    let connection;
    try {
      connection = await this.pool.getConnection();
      await connection.beginTransaction();
      let frameId;
      if (existingRows.length) {
        frameId = Number(existingRows[0].id);
        await connection.execute(
          `UPDATE scene_video_frames
           SET project_id = ?, source_scene_id = ?, file_url = ?, preview_url = ?, deleted_at = NULL
           WHERE id = ?`,
          [scene.project_id, scene.id, publicPath, publicPath, frameId],
        );
      } else {
        const [result] = await connection.execute(
          `INSERT INTO scene_video_frames
            (project_id, source_scene_id, source_generation_id, timestamp_ms, file_url, preview_url)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [scene.project_id, scene.id, generationId, timestampMs, publicPath, publicPath],
        );
        frameId = Number(result.insertId);
      }
      await connection.execute(
        `INSERT INTO scene_video_frame_usages (frame_id, target_scene_id, usage_type)
         VALUES (?, ?, 'reference_image')`,
        [frameId, targetScene.id],
      );
      await connection.commit();
      return (await this.listByGeneration(sceneId, generationId)).find(
        (item) => item.id === frameId,
      );
    } catch (error) {
      if (connection) await connection.rollback();
      await deleteGeneratedAsset(this.app, publicPath).catch(() => null);
      if (error?.code === 'ER_DUP_ENTRY') {
        const [duplicateRows] = await this.pool.query(
          `SELECT id FROM scene_video_frames
           WHERE source_generation_id = ? AND timestamp_ms = ? AND deleted_at IS NULL LIMIT 1`,
          [generationId, timestampMs],
        );
        if (duplicateRows.length) {
          await this.bind(duplicateRows[0].id, targetScene.id);
          return (await this.listByGeneration(sceneId, generationId)).find(
            (item) => item.id === Number(duplicateRows[0].id),
          );
        }
      }
      throw error;
    } finally {
      connection?.release();
    }
  }

  async bind(frameId, targetSceneId) {
    await this.pool.execute(
      `INSERT INTO scene_video_frame_usages (frame_id, target_scene_id, usage_type)
       VALUES (?, ?, 'reference_image')
       ON DUPLICATE KEY UPDATE usage_type = VALUES(usage_type)`,
      [frameId, targetSceneId],
    );
  }

  async remove(sceneId, generationId, frameId) {
    await this.validateSource(sceneId, generationId);
    const [rows] = await this.pool.query(
      `SELECT id, file_url FROM scene_video_frames
       WHERE id = ? AND source_scene_id = ? AND source_generation_id = ? AND deleted_at IS NULL`,
      [frameId, sceneId, generationId],
    );
    if (!rows.length) throw new Error('抽帧记录不存在');
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute('DELETE FROM scene_video_frame_usages WHERE frame_id = ?', [frameId]);
      await connection.execute('UPDATE scene_video_frames SET deleted_at = NOW() WHERE id = ?', [frameId]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    await deleteGeneratedAsset(this.app, rows[0].file_url).catch((error) =>
      this.ctx.logger.warn('delete video frame asset failed: %s', error.message),
    );
    return { success: true };
  }
}

module.exports = SceneVideoFrameService;
