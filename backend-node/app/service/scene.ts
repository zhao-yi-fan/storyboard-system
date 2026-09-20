'use strict';

const Service = require('egg').Service;

const { mapScene } = require('../lib/entity');

const { normalizeGeneratedAssetReference } = require('../lib/generated_asset');
const { assertCompositePromptLength } = require('../lib/composite_prompt');
const { optimizeStoryboardPrompt } = require('../lib/prompt_optimizer');
const { optimizeSceneDescription } = require('../lib/scene_description_optimizer');
const { SceneRepository } = require('../repository/scene_repository');
import type { DbRow, SceneEntity } from '../lib/entity';

class SceneService extends Service {
  get pool() {
    return this.app.mysqlPool;
  }

  get repository() {
    return new SceneRepository(this.pool);
  }

  /**
   * 查询章节是否存在，并拿到它所属的项目。
   * @param {number} id 章节 id，例如 `11`。
   * @returns {Promise<object|null>} 章节最小信息，不存在时返回 `null`。
   * @example
   * await service.findChapterById(11)
   * // => { id: 11, project_id: 19 }
   */
  async findChapterById(id: number) {
    return await this.repository.findChapterById(id);
  }

  /**
   * 读取章节下的所有场景。
   * @param {number} chapterId 章节 id，例如 `11`。
   * @returns {Promise<Array>} 场景列表，按排序字段升序返回。
   * @example
   * await service.findByChapterId(11)
   * // => [{ id: 21, chapter_id: 11, title: "便利店门口", sort_order: 1 }]
   */
  async findByChapterId(chapterId: number) {
    const chapter = await this.findChapterById(chapterId);
    if (!chapter) {
      throw new Error('chapter not found');
    }

    const rows = await this.repository.findByChapterId(chapterId);

    const items: SceneEntity[] = rows.map((row: DbRow) => mapScene(this.app, row));
    await this.attachCharacters(items);
    await this.attachAssets(items);
    await this.attachVideoFrameReferences(items);
    return items;
  }

  /**
   * 按 id 读取单个场景。
   * @param {number} id 场景 id，例如 `21`。
   * @returns {Promise<object|null>} 场景对象，不存在时返回 `null`。
   * @example
   * await service.findById(21)
   * // => { id: 21, title: "便利店门口", chapter_id: 11, project_id: 19 }
   */
  async findById(id: number) {
    const row = await this.repository.findById(id);
    if (!row) return null;
    const item = mapScene(this.app, row);
    await this.attachCharacters([item]);
    await this.attachAssets([item]);
    await this.attachVideoFrameReferences([item]);
    return item;
  }

  async attachVideoFrameReferences(items: SceneEntity[]) {
    const grouped = await this.ctx.service.sceneVideoFrame.listByTargetScenes(
      items.map((item) => item.id),
    );
    items.forEach((item) => {
      item.video_frame_references = grouped.get(Number(item.id)) || [];
    });
  }

  /**
   * 读取章节内当前最大的场景排序值。
   * @param {number} chapterId 章节 id，例如 `11`。
   * @returns {Promise<number>} 最大排序值，例如 `4`。
   * @example
   * await service.getMaxSortOrder(11)
   * // => 4
   */
  async getMaxSortOrder(chapterId: number) {
    return await this.repository.getMaxSortOrder(chapterId);
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
  async create(chapterId: number, payload: Record<string, unknown>) {
    const chapter = await this.findChapterById(chapterId);
    if (!chapter) {
      throw new Error('chapter not found');
    }

    const title = String(payload.title || '').trim();
    if (!title) {
      throw new Error('title is required');
    }

    const conn = await this.pool.getConnection();
    let sceneId;
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(
        'SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM scenes WHERE chapter_id = ? AND deleted_at IS NULL',
        [chapterId],
      );
      const maxSortOrder = Number(rows[0]?.max_sort || 0);
      const requestedSortOrder = Number(payload.sort_order);
      const sortOrder =
        Number.isInteger(requestedSortOrder) && requestedSortOrder > 0
          ? Math.min(requestedSortOrder, maxSortOrder + 1)
          : maxSortOrder + 1;

      if (sortOrder <= maxSortOrder) {
        await conn.execute(
          'UPDATE scenes SET sort_order = sort_order + 1 WHERE chapter_id = ? AND deleted_at IS NULL AND sort_order >= ?',
          [chapterId, sortOrder],
        );
      }

      const [result] = await conn.execute(
        `INSERT INTO scenes (
          chapter_id, project_id, title, description, prompt, location, time_of_day, style_preset, style_notes,
          cover_url, cover_preview_url, video_url, video_preview_url, video_poster_url, video_status, video_error, video_duration, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', '', '', '', '', NULL, NULL, ?)`,
        [
          chapterId,
          Number(chapter.project_id),
          title,
          String(payload.description || ''),
          String(payload.prompt || ''),
          String(payload.location || ''),
          String(payload.time_of_day || ''),
          String(payload.style_preset || ''),
          String(payload.style_notes || ''),
          sortOrder,
        ],
      );
      sceneId = result.insertId;
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }

    return await this.findById(sceneId);
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
  async update(id: number, payload: Record<string, unknown>) {
    const current = await this.findById(id);
    if (!current) {
      throw new Error('scene not found');
    }

    const title =
      Object.prototype.hasOwnProperty.call(payload, 'title') && String(payload.title || '').trim()
        ? String(payload.title || '').trim()
        : current.title;
    if (!title) {
      throw new Error('title is required');
    }

    const sortOrder =
      Object.prototype.hasOwnProperty.call(payload, 'sort_order') && Number(payload.sort_order)
        ? Number(payload.sort_order)
        : current.sort_order;

    await this.pool.execute(
      `UPDATE scenes
       SET title = ?, description = ?, prompt = ?, location = ?, time_of_day = ?, style_preset = ?, style_notes = ?,
           cover_url = ?, cover_preview_url = ?, video_url = ?, video_preview_url = ?, video_poster_url = ?, video_status = ?, video_error = ?, video_duration = ?,
           generation_duration = ?, sort_order = ?
       WHERE id = ?`,
      [
        title,
        Object.prototype.hasOwnProperty.call(payload, 'description')
          ? String(payload.description || '')
          : current.description,
        Object.prototype.hasOwnProperty.call(payload, 'prompt')
          ? assertCompositePromptLength(payload.prompt)
          : current.prompt,
        Object.prototype.hasOwnProperty.call(payload, 'location')
          ? String(payload.location || '')
          : current.location,
        Object.prototype.hasOwnProperty.call(payload, 'time_of_day')
          ? String(payload.time_of_day || '')
          : current.time_of_day,
        Object.prototype.hasOwnProperty.call(payload, 'style_preset')
          ? String(payload.style_preset || '')
          : current.style_preset,
        Object.prototype.hasOwnProperty.call(payload, 'style_notes')
          ? String(payload.style_notes || '')
          : current.style_notes,
        Object.prototype.hasOwnProperty.call(payload, 'cover_url')
          ? normalizeGeneratedAssetReference(this.app, String(payload.cover_url || ''))
          : normalizeGeneratedAssetReference(this.app, current.cover_url),
        Object.prototype.hasOwnProperty.call(payload, 'cover_preview_url')
          ? normalizeGeneratedAssetReference(this.app, String(payload.cover_preview_url || ''))
          : normalizeGeneratedAssetReference(this.app, current.cover_preview_url),
        Object.prototype.hasOwnProperty.call(payload, 'video_url')
          ? normalizeGeneratedAssetReference(this.app, String(payload.video_url || ''))
          : normalizeGeneratedAssetReference(this.app, current.video_url),
        Object.prototype.hasOwnProperty.call(payload, 'video_preview_url')
          ? normalizeGeneratedAssetReference(this.app, String(payload.video_preview_url || ''))
          : normalizeGeneratedAssetReference(this.app, current.video_preview_url),
        Object.prototype.hasOwnProperty.call(payload, 'video_poster_url')
          ? normalizeGeneratedAssetReference(this.app, String(payload.video_poster_url || ''))
          : normalizeGeneratedAssetReference(this.app, current.video_poster_url),
        Object.prototype.hasOwnProperty.call(payload, 'video_status')
          ? String(payload.video_status || '')
          : current.video_status,
        Object.prototype.hasOwnProperty.call(payload, 'video_error')
          ? String(payload.video_error || '')
          : current.video_error,
        Object.prototype.hasOwnProperty.call(payload, 'video_duration')
          ? payload.video_duration === null ||
            payload.video_duration === undefined ||
            payload.video_duration === ''
            ? null
            : Number(payload.video_duration)
          : current.video_duration,
        Object.prototype.hasOwnProperty.call(payload, 'generation_duration')
          ? Number(payload.generation_duration || 5)
          : current.generation_duration,
        sortOrder,
        id,
      ],
    );

    return await this.findById(id);
  }

  async optimizePrompt(id: number, payload: Record<string, unknown>) {
    const scene = await this.findById(id);
    if (!scene) {
      throw new Error('scene not found');
    }

    return await optimizeStoryboardPrompt(this.config.storyboard, payload.prompt, {
      title: scene.title,
      duration: scene.generation_duration,
    });
  }

  async optimizeDescription(payload: Record<string, unknown>) {
    return await optimizeSceneDescription(this.config.storyboard, payload);
  }

  /**
   * 软删除场景。
   * @param {number} id 场景 id，例如 `21`。
   * @returns {Promise<void>} 写入删除标记后返回。
   * @example
   * await service.softDelete(21)
   * // => void
   */
  async softDelete(id: number) {
    await this.pool.execute('UPDATE scenes SET deleted_at = NOW() WHERE id = ?', [id]);
  }

  async attachCharacters(items: SceneEntity[]) {
    if (!items.length) return;
    const ids = items.map((item) => item.id);
    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await this.pool.query(
      `SELECT sc.scene_id, c.id, c.project_id, c.name, c.description, c.avatar_url,
              c.design_sheet_url, c.voice_reference_url, c.voice_reference_duration,
              c.voice_reference_text, c.voice_name, c.voice_prompt, c.created_at, c.updated_at
       FROM scene_characters sc
       JOIN characters c ON c.id = sc.character_id
       WHERE sc.scene_id IN (${placeholders}) AND c.deleted_at IS NULL
       ORDER BY sc.scene_id ASC, c.id ASC`,
      ids,
    );
    const byScene = new Map(items.map((item) => [item.id, item]));
    for (const row of rows) {
      const target = byScene.get(Number(row.scene_id));
      if (!target) continue;
      const character = this.ctx.service.character.map(row);
      target.characters.push(character);
      target.character_names.push(character.name);
    }
  }

  async attachAssets(items: SceneEntity[]) {
    if (!items.length) return;
    const ids = items.map((item) => item.id);
    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await this.pool.query(
      `SELECT DISTINCT sau.scene_id, a.id, a.project_id, a.character_id, a.name, a.type,
              a.file_url, a.cover_url, a.thumbnail_url, a.meta, a.created_at, a.updated_at
       FROM scene_asset_usages sau
       JOIN assets a ON a.id = sau.asset_id
       WHERE sau.scene_id IN (${placeholders}) AND a.deleted_at IS NULL
       ORDER BY sau.scene_id ASC, a.id ASC`,
      ids,
    );
    const byScene = new Map(items.map((item) => [item.id, item]));
    for (const row of rows) {
      const target = byScene.get(Number(row.scene_id));
      if (!target) continue;
      const asset = this.ctx.service.asset.map(row);
      target.assets.push(asset);
      target.asset_names.push(asset.name);
    }
  }

  async addCharacter(sceneId: number, characterId: number) {
    const scene = await this.findById(sceneId);
    const character = await this.ctx.service.character.findById(characterId);
    if (!scene) throw new Error('scene not found');
    if (!character || Number(character.project_id) !== Number(scene.project_id)) {
      throw new Error('character does not belong to the same project');
    }
    await this.pool.execute(
      `INSERT INTO scene_characters (scene_id, character_id, line)
       VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE line = VALUES(line)`,
      [sceneId, characterId, String(scene.prompt || '')],
    );
    await this.ctx.service.assetRequirement.syncAssetRequirements(
      scene.project_id,
      scene.chapter_id,
    );
    return await this.findById(sceneId);
  }

  async removeCharacter(sceneId: number, characterId: number) {
    const scene = await this.findById(sceneId);
    if (!scene) throw new Error('scene not found');
    await this.pool.execute(
      'DELETE FROM scene_characters WHERE scene_id = ? AND character_id = ?',
      [sceneId, characterId],
    );
    await this.ctx.service.assetRequirement.syncAssetRequirements(
      scene.project_id,
      scene.chapter_id,
    );
    return await this.findById(sceneId);
  }

  async addAsset(sceneId: number, assetId: number) {
    const scene = await this.findById(sceneId);
    const asset = await this.ctx.service.asset.findById(assetId);
    if (!scene) throw new Error('scene not found');
    if (!asset || Number(asset.project_id) !== Number(scene.project_id)) {
      throw new Error('asset does not belong to the same project');
    }
    await this.pool.execute(
      `INSERT INTO scene_asset_usages (scene_id, asset_id, usage_type)
       VALUES (?, ?, 'reference_asset')
       ON DUPLICATE KEY UPDATE usage_type = VALUES(usage_type)`,
      [sceneId, assetId],
    );
    await this.ctx.service.assetRequirement.syncAssetRequirements(
      scene.project_id,
      scene.chapter_id,
    );
    return await this.findById(sceneId);
  }

  async removeAsset(sceneId: number, assetId: number) {
    const scene = await this.findById(sceneId);
    if (!scene) throw new Error('scene not found');
    await this.pool.execute('DELETE FROM scene_asset_usages WHERE scene_id = ? AND asset_id = ?', [
      sceneId,
      assetId,
    ]);
    await this.ctx.service.assetRequirement.syncAssetRequirements(
      scene.project_id,
      scene.chapter_id,
    );
    return await this.findById(sceneId);
  }
}

module.exports = SceneService;
