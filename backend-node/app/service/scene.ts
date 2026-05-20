'use strict';
// @ts-nocheck

const Service = require('egg').Service;
const path = require('node:path');
const { mapScene } = require('../lib/entity');
const { sanitizeFileName, storyboardPreviewSpec, downloadAndStore, createPreviewFromLocalPath, composeVideos } = require('../lib/media');
const { generateWanxImage } = require('../lib/ai_clients');
const { normalizeGeneratedAssetReference } = require('../lib/generated_asset');
const { buildSceneCoverPrompt } = require('../lib/prompt_library');

class SceneService extends Service {
  get pool() {
    return this.app.mysqlPool;
  }

  async findChapterById(id) {
    const [ rows ] = await this.pool.query(
      'SELECT id, project_id FROM chapters WHERE id = ? AND deleted_at IS NULL',
      [ id ]
    );
    return rows[0] || null;
  }

  async findByChapterId(chapterId) {
    const chapter = await this.findChapterById(chapterId);
    if (!chapter) {
      throw new Error('chapter not found');
    }

    const [ rows ] = await this.pool.query(
      `SELECT id, chapter_id, project_id, title, description, location, time_of_day, style_preset, style_notes,
              cover_url, cover_preview_url, video_url, video_preview_url, video_status, video_error, video_duration,
              sort_order, created_at, updated_at
       FROM scenes
       WHERE chapter_id = ? AND deleted_at IS NULL
       ORDER BY sort_order ASC, id ASC`,
      [ chapterId ]
    );

    return rows.map(row => mapScene(this.app, row));
  }

  async findById(id) {
    const [ rows ] = await this.pool.query(
      `SELECT id, chapter_id, project_id, title, description, location, time_of_day, style_preset, style_notes,
              cover_url, cover_preview_url, video_url, video_preview_url, video_status, video_error, video_duration,
              sort_order, created_at, updated_at
       FROM scenes
       WHERE id = ? AND deleted_at IS NULL`,
      [ id ]
    );

    return rows.length ? mapScene(this.app, rows[0]) : null;
  }

  async getMaxSortOrder(chapterId) {
    const [ rows ] = await this.pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM scenes WHERE chapter_id = ? AND deleted_at IS NULL',
      [ chapterId ]
    );
    return Number(rows[0]?.max_sort || 0);
  }

  async create(chapterId, payload) {
    const chapter = await this.findChapterById(chapterId);
    if (!chapter) {
      throw new Error('chapter not found');
    }

    const title = String(payload.title || '').trim();
    if (!title) {
      throw new Error('title is required');
    }

    const sortOrder = (await this.getMaxSortOrder(chapterId)) + 1;
    const [ result ] = await this.pool.execute(
      `INSERT INTO scenes (
        chapter_id, project_id, title, description, location, time_of_day, style_preset, style_notes,
        cover_url, cover_preview_url, video_url, video_preview_url, video_status, video_error, video_duration, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', '', '', '', '', '', NULL, ?)`,
      [
        chapterId,
        Number(chapter.project_id),
        title,
        String(payload.description || ''),
        String(payload.location || ''),
        String(payload.time_of_day || ''),
        String(payload.style_preset || ''),
        String(payload.style_notes || ''),
        sortOrder,
      ]
    );

    return await this.findById(result.insertId);
  }

  async update(id, payload) {
    const current = await this.findById(id);
    if (!current) {
      throw new Error('scene not found');
    }

    const title = Object.prototype.hasOwnProperty.call(payload, 'title') && String(payload.title || '').trim()
      ? String(payload.title || '').trim()
      : current.title;
    if (!title) {
      throw new Error('title is required');
    }

    const sortOrder = Object.prototype.hasOwnProperty.call(payload, 'sort_order') && Number(payload.sort_order)
      ? Number(payload.sort_order)
      : current.sort_order;

    await this.pool.execute(
      `UPDATE scenes
       SET title = ?, description = ?, location = ?, time_of_day = ?, style_preset = ?, style_notes = ?,
           cover_url = ?, cover_preview_url = ?, video_url = ?, video_preview_url = ?, video_status = ?, video_error = ?, video_duration = ?,
           sort_order = ?
       WHERE id = ?`,
      [
        title,
        Object.prototype.hasOwnProperty.call(payload, 'description') ? String(payload.description || '') : current.description,
        Object.prototype.hasOwnProperty.call(payload, 'location') ? String(payload.location || '') : current.location,
        Object.prototype.hasOwnProperty.call(payload, 'time_of_day') ? String(payload.time_of_day || '') : current.time_of_day,
        Object.prototype.hasOwnProperty.call(payload, 'style_preset') ? String(payload.style_preset || '') : current.style_preset,
        Object.prototype.hasOwnProperty.call(payload, 'style_notes') ? String(payload.style_notes || '') : current.style_notes,
        Object.prototype.hasOwnProperty.call(payload, 'cover_url') ? normalizeGeneratedAssetReference(this.app, String(payload.cover_url || '')) : normalizeGeneratedAssetReference(this.app, current.cover_url),
        Object.prototype.hasOwnProperty.call(payload, 'cover_preview_url') ? normalizeGeneratedAssetReference(this.app, String(payload.cover_preview_url || '')) : normalizeGeneratedAssetReference(this.app, current.cover_preview_url),
        Object.prototype.hasOwnProperty.call(payload, 'video_url') ? normalizeGeneratedAssetReference(this.app, String(payload.video_url || '')) : normalizeGeneratedAssetReference(this.app, current.video_url),
        Object.prototype.hasOwnProperty.call(payload, 'video_preview_url') ? normalizeGeneratedAssetReference(this.app, String(payload.video_preview_url || '')) : normalizeGeneratedAssetReference(this.app, current.video_preview_url),
        Object.prototype.hasOwnProperty.call(payload, 'video_status') ? String(payload.video_status || '') : current.video_status,
        Object.prototype.hasOwnProperty.call(payload, 'video_error') ? String(payload.video_error || '') : current.video_error,
        Object.prototype.hasOwnProperty.call(payload, 'video_duration')
          ? (payload.video_duration == null || payload.video_duration === '' ? null : Number(payload.video_duration))
          : current.video_duration,
        sortOrder,
        id,
      ]
    );

    return await this.findById(id);
  }

  async softDelete(id) {
    await this.pool.execute('UPDATE scenes SET deleted_at = NOW() WHERE id = ?', [ id ]);
  }

  buildCoverPrompt(scene, storyboards) {
    return buildSceneCoverPrompt(scene, storyboards).prompt;
  }

  async previewCoverGeneration(id) {
    const scene = await this.findById(id);
    if (!scene) {
      throw new Error('scene not found');
    }
    const storyboards = await this.ctx.service.storyboard.findBySceneId(id);
    const coverPrompt = buildSceneCoverPrompt(scene, storyboards);
    return {
      action: 'scene-cover',
      model: this.app.config.storyboard.wanxModel || 'wanx2.0-t2i-turbo',
      fields: {
        场景标题: String(scene.title || '').trim(),
        地点: String(scene.location || '').trim(),
        时间: String(scene.time_of_day || '').trim(),
        场景描述: String(scene.description || '').trim(),
        镜头数量: String(storyboards.length),
        输出: '场景级代表封面',
      },
      template: coverPrompt.template,
      prompt_blueprint: coverPrompt.blueprint,
      final_prompt: coverPrompt.prompt,
      notes: [ '场景封面用于场景树和场景头部预览，强调代表性和叙事感。' ],
    };
  }

  async generateCover(id) {
    const scene = await this.findById(id);
    if (!scene) {
      throw new Error('scene not found');
    }
    const storyboards = await this.ctx.service.storyboard.findBySceneId(id);
    const prompt = this.buildCoverPrompt(scene, storyboards);
    const imageUrl = await generateWanxImage(this.app, prompt, this.app.config.storyboard.wanxModel || 'qwen-image-2.0');
    const filename = `${sanitizeFileName(`scene-${id}`)}-${Date.now()}.png`;
    const stored = await downloadAndStore(this.app, imageUrl, 'scene-covers', filename, 'image/png');
    const previewFilename = `${path.basename(filename, path.extname(filename))}.thumb.webp`;
    const previewPath = await createPreviewFromLocalPath(this.app, stored.localPath, 'scene-covers', previewFilename, storyboardPreviewSpec());
    return await this.update(id, {
      cover_url: stored.publicPath,
      cover_preview_url: previewPath,
    });
  }

  async generateStoryboardCovers(id) {
    const storyboards = await this.ctx.service.storyboard.findBySceneId(id);
    const failed = [];
    let generatedCount = 0;
    for (const storyboard of storyboards) {
      try {
        await this.ctx.service.storyboard.generateCover(storyboard.id, '', false);
        generatedCount++;
      } catch (error) {
        failed.push({ storyboard_id: storyboard.id, error: error.message });
      }
    }
    return {
      scene: await this.findById(id),
      storyboards: await this.ctx.service.storyboard.findBySceneId(id),
      generated_count: generatedCount,
      failed,
    };
  }

  async composeVideo(id, regenerate) {
    const scene = await this.findById(id);
    if (!scene) {
      throw new Error('scene not found');
    }
    if (!regenerate && scene.video_url) {
      return scene;
    }
    const inputs = await this.ctx.service.storyboard.listSceneVideoInputs(id);
    if (!inputs.length) {
      throw new Error('当前场景没有可合成的视频镜头');
    }
    await this.update(id, { video_status: 'generating', video_error: '' });
    try {
      const filename = `${sanitizeFileName(`scene-${id}`)}-${Date.now()}.mp4`;
      const composed = await composeVideos(this.app, inputs.map(item => item.source), 'scene-videos', filename);
      return await this.update(id, {
        video_url: composed.publicPath,
        video_preview_url: composed.previewPath,
        video_status: 'succeeded',
        video_error: '',
        video_duration: composed.duration,
      });
    } catch (error) {
      await this.update(id, {
        video_status: 'failed',
        video_error: error.message,
      });
      throw error;
    }
  }
}

module.exports = SceneService;
