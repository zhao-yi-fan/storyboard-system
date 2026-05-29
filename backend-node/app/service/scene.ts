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

  /**
   * 查询章节是否存在，并拿到它所属的项目。
   * @param {number} id 章节 id，例如 `11`。
   * @returns {Promise<object|null>} 章节最小信息，不存在时返回 `null`。
   * @example
   * await service.findChapterById(11)
   * // => { id: 11, project_id: 19 }
   */
  async findChapterById(id) {
    const [ rows ] = await this.pool.query(
      'SELECT id, project_id FROM chapters WHERE id = ? AND deleted_at IS NULL',
      [ id ]
    );
    return rows[0] || null;
  }

  /**
   * 读取章节下的所有场景。
   * @param {number} chapterId 章节 id，例如 `11`。
   * @returns {Promise<Array>} 场景列表，按排序字段升序返回。
   * @example
   * await service.findByChapterId(11)
   * // => [{ id: 21, chapter_id: 11, title: "便利店门口", sort_order: 1 }]
   */
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

  /**
   * 按 id 读取单个场景。
   * @param {number} id 场景 id，例如 `21`。
   * @returns {Promise<object|null>} 场景对象，不存在时返回 `null`。
   * @example
   * await service.findById(21)
   * // => { id: 21, title: "便利店门口", chapter_id: 11, project_id: 19 }
   */
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

  /**
   * 读取章节内当前最大的场景排序值。
   * @param {number} chapterId 章节 id，例如 `11`。
   * @returns {Promise<number>} 最大排序值，例如 `4`。
   * @example
   * await service.getMaxSortOrder(11)
   * // => 4
   */
  async getMaxSortOrder(chapterId) {
    const [ rows ] = await this.pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM scenes WHERE chapter_id = ? AND deleted_at IS NULL',
      [ chapterId ]
    );
    return Number(rows[0]?.max_sort || 0);
  }

  /**
   * 在指定章节下创建场景。
   * @param {number} chapterId 章节 id，例如 `11`。
   * @param {Record<string, unknown>} payload 输入数据，例如 `{ title: "便利店门口", location: "街角" }`。
   * @returns {Promise<object>} 新建后的场景对象。
   * @example
   * await service.create(11, { title: "便利店门口", location: "街角" })
   * // => { id: 21, chapter_id: 11, title: "便利店门口", sort_order: 1 }
   */
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

  /**
   * 更新场景基础信息和媒体状态字段。
   * @param {number} id 场景 id，例如 `21`。
   * @param {Record<string, unknown>} payload 局部补丁，例如 `{ title: "便利店门口（夜）", style_notes: "冷光" }`。
   * @returns {Promise<object>} 更新后的场景对象。
   * @example
   * await service.update(21, { title: "便利店门口（夜）" })
   * // => { id: 21, title: "便利店门口（夜）" }
   */
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

  /**
   * 软删除场景。
   * @param {number} id 场景 id，例如 `21`。
   * @returns {Promise<void>} 写入删除标记后返回。
   * @example
   * await service.softDelete(21)
   * // => void
   */
  async softDelete(id) {
    await this.pool.execute('UPDATE scenes SET deleted_at = NOW() WHERE id = ?', [ id ]);
  }

  /**
   * 生成场景封面用的最终 prompt 文本。
   * @param {object} scene 场景对象，例如 `{ title: "便利店门口" }`。
   * @param {Array} storyboards 场景下镜头列表，例如 `[{ content: "李明抬头" }]`。
   * @returns {string} 最终 prompt 文本。
   * @example
   * service.buildCoverPrompt({ title: "便利店门口" }, [{ content: "李明抬头" }])
   * // => "..."
   */
  buildCoverPrompt(scene, storyboards) {
    return buildSceneCoverPrompt(scene, storyboards).prompt;
  }

  /**
   * 预览场景封面生成参数和 prompt。
   * @param {number} id 场景 id，例如 `21`。
   * @returns {Promise<object>} 预览信息，包含字段摘要、模板和最终 prompt。
   * @example
   * await service.previewCoverGeneration(21)
   * // => { action: "scene-cover", model: "wan2.7-image-pro", final_prompt: "..." }
   */
  async previewCoverGeneration(id) {
    const scene = await this.findById(id);
    if (!scene) {
      throw new Error('scene not found');
    }
    const storyboards = await this.ctx.service.storyboard.findBySceneId(id);
    const coverPrompt = buildSceneCoverPrompt(scene, storyboards);
    return {
      action: 'scene-cover',
      model: this.app.config.storyboard.wanxModel || 'wan2.7-image-pro',
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

  /**
   * 真正生成场景封面，并回写封面图和预览图。
   * @param {number} id 场景 id，例如 `21`。
   * @returns {Promise<object>} 更新后的场景对象。
   * @example
   * await service.generateCover(21)
   * // => { id: 21, cover_url: "/generated/scene-covers/scene-21-....png" }
   */
  async generateCover(id) {
    const scene = await this.findById(id);
    if (!scene) {
      throw new Error('scene not found');
    }
    const storyboards = await this.ctx.service.storyboard.findBySceneId(id);
    const prompt = this.buildCoverPrompt(scene, storyboards);
    const imageUrl = await generateWanxImage(this.app, prompt, this.app.config.storyboard.wanxModel || 'wan2.7-image-pro');
    const filename = `${sanitizeFileName(`scene-${id}`)}-${Date.now()}.png`;
    const stored = await downloadAndStore(this.app, imageUrl, 'scene-covers', filename, 'image/png');
    const previewFilename = `${path.basename(filename, path.extname(filename))}.thumb.webp`;
    const previewPath = await createPreviewFromLocalPath(this.app, stored.localPath, 'scene-covers', previewFilename, storyboardPreviewSpec());
    return await this.update(id, {
      cover_url: stored.publicPath,
      cover_preview_url: previewPath,
    });
  }

  /**
   * 批量为场景下所有镜头生成封面。
   * @param {number} id 场景 id，例如 `21`。
   * @returns {Promise<object>} 批量结果，包含成功数量和失败项。
   * @example
   * await service.generateStoryboardCovers(21)
   * // => { generated_count: 8, failed: [] }
   */
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

  /**
   * 合成场景视频。
   * @param {number} id 场景 id，例如 `21`。
   * @param {boolean} regenerate 已有视频时，是否强制重新合成。
   * @returns {Promise<object>} 更新后的场景对象。
   * @example
   * await service.composeVideo(21, true)
   * // => { id: 21, video_url: "/generated/scene-videos/scene-21-....mp4", video_status: "succeeded" }
   */
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
