'use strict';

const Service = require('egg').Service;

const { mapStoryboard } = require('../lib/entity');
const { normalizeGeneratedAssetReference } = require('../lib/generated_asset');
import type { DbRow, StoryboardEntity } from '../lib/entity';
const { assertCompositePromptLength } = require('../lib/composite_prompt');
const { StoryboardRepository } = require('../repository/storyboard_repository');
const { GENERATION_STATUS, MEDIA_TYPE } = require('../lib/domain_constants');

class StoryboardService extends Service {
  static REFERENCE_ASSET_USAGE = 'reference_asset';

  get pool() {
    return this.app.mysqlPool;
  }

  get repository() {
    return new StoryboardRepository(this.pool);
  }

  async findSceneById(id: number) {
    return await this.repository.findSceneById(id);
  }

  async findBySceneId(sceneId: number) {
    const scene = await this.findSceneById(sceneId);
    if (!scene) {
      throw new Error('scene not found');
    }

    const rows = await this.repository.findBySceneId(sceneId);

    const items: StoryboardEntity[] = rows.map((row: DbRow) => mapStoryboard(this.app, row));
    await this.attachCharacters(items);
    await this.attachAssets(items);
    return items;
  }

  async findById(id: number) {
    const row = await this.repository.findById(id);
    if (!row) {
      return null;
    }
    const item = mapStoryboard(this.app, row);
    await this.attachCharacters([item]);
    await this.attachAssets([item]);
    return item;
  }

  async getMaxSortOrder(sceneId: number) {
    return await this.repository.getMaxSortOrder(sceneId);
  }

  async create(sceneId: number, payload: Record<string, unknown>) {
    const scene = await this.findSceneById(sceneId);
    if (!scene) {
      throw new Error('scene not found');
    }

    const content = assertCompositePromptLength(payload.content);
    if (!content) {
      throw new Error('content is required');
    }

    const sortOrder = (await this.getMaxSortOrder(sceneId)) + 1;
    const shotNumber = Number(payload.shot_number) || sortOrder;

    const [result] = await this.pool.execute(
      `INSERT INTO storyboards (
        scene_id, chapter_id, project_id, shot_number, content, dialogue, shot_type, mood, style_preset, style_notes,
        camera_direction, camera_motion, duration, background, thumbnail_url, thumbnail_preview_url, video_url, video_preview_url,
        video_status, video_error, video_duration, notes, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', '', '', NULL, ?, ?)`,
      [
        sceneId,
        Number(scene.chapter_id),
        Number(scene.project_id),
        shotNumber,
        content,
        String(payload.dialogue || ''),
        String(payload.shot_type || ''),
        String(payload.mood || ''),
        String(payload.style_preset || ''),
        String(payload.style_notes || ''),
        String(payload.camera_direction || ''),
        String(payload.camera_motion || ''),
        payload.duration === null || payload.duration === undefined || payload.duration === ''
          ? null
          : Number(payload.duration),
        String(payload.background || ''),
        String(payload.thumbnail_url || ''),
        String(payload.thumbnail_preview_url || ''),
        String(payload.notes || ''),
        sortOrder,
      ],
    );

    return await this.findById(result.insertId);
  }

  async update(id: number, payload: Record<string, unknown>) {
    const current = await this.findById(id);
    if (!current) {
      throw new Error('storyboard not found');
    }

    const content = Object.prototype.hasOwnProperty.call(payload, 'content')
      ? assertCompositePromptLength(payload.content)
      : current.content;
    if (!content) {
      throw new Error('content is required');
    }

    const sortOrder =
      Object.prototype.hasOwnProperty.call(payload, 'sort_order') && Number(payload.sort_order)
        ? Number(payload.sort_order)
        : current.sort_order;

    await this.pool.execute(
      `UPDATE storyboards
       SET shot_number = ?, content = ?, dialogue = ?, shot_type = ?, mood = ?, style_preset = ?, style_notes = ?,
           camera_direction = ?, camera_motion = ?, duration = ?, background = ?, thumbnail_url = ?, thumbnail_preview_url = ?,
           video_url = ?, video_preview_url = ?, video_status = ?, video_error = ?, video_duration = ?, notes = ?, sort_order = ?
       WHERE id = ?`,
      [
        Object.prototype.hasOwnProperty.call(payload, 'shot_number')
          ? Number(payload.shot_number || 0)
          : current.shot_number,
        content,
        Object.prototype.hasOwnProperty.call(payload, 'dialogue')
          ? String(payload.dialogue || '')
          : current.dialogue,
        Object.prototype.hasOwnProperty.call(payload, 'shot_type')
          ? String(payload.shot_type || '')
          : current.shot_type,
        Object.prototype.hasOwnProperty.call(payload, 'mood')
          ? String(payload.mood || '')
          : current.mood,
        Object.prototype.hasOwnProperty.call(payload, 'style_preset')
          ? String(payload.style_preset || '')
          : current.style_preset,
        Object.prototype.hasOwnProperty.call(payload, 'style_notes')
          ? String(payload.style_notes || '')
          : current.style_notes,
        Object.prototype.hasOwnProperty.call(payload, 'camera_direction')
          ? String(payload.camera_direction || '')
          : current.camera_direction,
        Object.prototype.hasOwnProperty.call(payload, 'camera_motion')
          ? String(payload.camera_motion || '')
          : current.camera_motion,
        Object.prototype.hasOwnProperty.call(payload, 'duration')
          ? payload.duration === null || payload.duration === undefined || payload.duration === ''
            ? null
            : Number(payload.duration)
          : current.duration,
        Object.prototype.hasOwnProperty.call(payload, 'background')
          ? String(payload.background || '')
          : current.background,
        Object.prototype.hasOwnProperty.call(payload, 'thumbnail_url')
          ? normalizeGeneratedAssetReference(this.app, String(payload.thumbnail_url || ''))
          : normalizeGeneratedAssetReference(this.app, current.thumbnail_url),
        Object.prototype.hasOwnProperty.call(payload, 'thumbnail_preview_url')
          ? normalizeGeneratedAssetReference(this.app, String(payload.thumbnail_preview_url || ''))
          : normalizeGeneratedAssetReference(this.app, current.thumbnail_preview_url),
        Object.prototype.hasOwnProperty.call(payload, 'video_url')
          ? normalizeGeneratedAssetReference(this.app, String(payload.video_url || ''))
          : normalizeGeneratedAssetReference(this.app, current.video_url),
        Object.prototype.hasOwnProperty.call(payload, 'video_preview_url')
          ? normalizeGeneratedAssetReference(this.app, String(payload.video_preview_url || ''))
          : normalizeGeneratedAssetReference(this.app, current.video_preview_url),
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
        Object.prototype.hasOwnProperty.call(payload, 'notes')
          ? String(payload.notes || '')
          : current.notes,
        sortOrder,
        id,
      ],
    );

    return await this.findById(id);
  }

  async softDelete(id: number) {
    await this.pool.execute('UPDATE storyboards SET deleted_at = NOW() WHERE id = ?', [id]);
  }

  async attachCharacters(items: StoryboardEntity[]) {
    if (!items.length) {
      return;
    }
    const ids = items.map((item) => item.id);
    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await this.pool.query(
      `SELECT sc.storyboard_id, c.id, c.project_id, c.name, c.description, c.avatar_url,
              c.design_sheet_url, c.voice_reference_url, c.voice_reference_duration,
              c.voice_reference_text, c.voice_name, c.voice_prompt, c.created_at, c.updated_at
       FROM storyboard_characters sc
       JOIN characters c ON c.id = sc.character_id
       WHERE sc.storyboard_id IN (${placeholders}) AND c.deleted_at IS NULL
       ORDER BY sc.storyboard_id ASC, c.id ASC`,
      ids,
    );
    const byStoryboard = new Map(items.map((item) => [item.id, item]));
    for (const row of rows) {
      const target = byStoryboard.get(Number(row.storyboard_id));
      if (!target) {
        continue;
      }
      const character = this.ctx.service.character.map(row);
      target.characters.push(character);
      target.character_names.push(character.name);
    }
  }

  async attachAssets(items: StoryboardEntity[]) {
    if (!items.length) {
      return;
    }
    const ids = items.map((item) => item.id);
    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await this.pool.query(
      `SELECT DISTINCT sau.storyboard_id, a.id, a.project_id, a.character_id, a.name, a.type, a.file_url, a.cover_url, a.thumbnail_url, a.meta, a.created_at, a.updated_at
       FROM storyboard_asset_usages sau
       JOIN assets a ON a.id = sau.asset_id
       WHERE sau.storyboard_id IN (${placeholders}) AND a.deleted_at IS NULL
       ORDER BY sau.storyboard_id ASC, a.id ASC`,
      ids,
    );
    const byStoryboard = new Map(items.map((item) => [item.id, item]));
    for (const row of rows) {
      const target = byStoryboard.get(Number(row.storyboard_id));
      if (!target) {
        continue;
      }
      const asset = this.ctx.service.asset.map(row);
      target.assets.push(asset);
      target.asset_names.push(asset.name);
    }
  }

  async addCharacter(storyboardId: number, characterId: number) {
    const storyboard = await this.findById(storyboardId);
    if (!storyboard) {
      throw new Error('storyboard not found');
    }
    const character = await this.ctx.service.character.findById(characterId);
    if (!character) {
      throw new Error('character not found');
    }
    if (Number(character.project_id) !== Number(storyboard.project_id)) {
      throw new Error('character does not belong to the same project');
    }
    await this.pool.execute(
      `INSERT INTO storyboard_characters (storyboard_id, character_id, line)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE line = VALUES(line)`,
      [storyboardId, characterId, String(storyboard.dialogue || storyboard.content || '').trim()],
    );
    await this.ctx.service.assetWorkspace.syncAssetRequirements(
      storyboard.project_id,
      storyboard.chapter_id,
    );
    return await this.findById(storyboardId);
  }

  async removeCharacter(storyboardId: number, characterId: number) {
    const storyboard = await this.findById(storyboardId);
    if (!storyboard) {
      throw new Error('storyboard not found');
    }
    await this.pool.execute(
      'DELETE FROM storyboard_characters WHERE storyboard_id = ? AND character_id = ?',
      [storyboardId, characterId],
    );
    await this.ctx.service.assetWorkspace.syncAssetRequirements(
      storyboard.project_id,
      storyboard.chapter_id,
    );
    return await this.findById(storyboardId);
  }

  async addAsset(storyboardId: number, assetId: number) {
    const storyboard = await this.findById(storyboardId);
    if (!storyboard) {
      throw new Error('storyboard not found');
    }
    const asset = await this.ctx.service.asset.findById(assetId);
    if (!asset) {
      throw new Error('asset not found');
    }
    if (Number(asset.project_id) !== Number(storyboard.project_id)) {
      throw new Error('asset does not belong to the same project');
    }
    await this.pool.execute(
      'DELETE FROM storyboard_asset_usages WHERE storyboard_id = ? AND asset_id = ?',
      [storyboardId, assetId],
    );
    await this.pool.execute(
      `INSERT INTO storyboard_asset_usages (storyboard_id, asset_id, usage_type)
       VALUES (?, ?, ?)`,
      [storyboardId, assetId, StoryboardService.REFERENCE_ASSET_USAGE],
    );
    await this.ctx.service.assetWorkspace.syncAssetRequirements(
      storyboard.project_id,
      storyboard.chapter_id,
    );
    return await this.findById(storyboardId);
  }

  async removeAsset(storyboardId: number, assetId: number) {
    const storyboard = await this.findById(storyboardId);
    if (!storyboard) {
      throw new Error('storyboard not found');
    }
    await this.pool.execute(
      'DELETE FROM storyboard_asset_usages WHERE storyboard_id = ? AND asset_id = ?',
      [storyboardId, assetId],
    );
    await this.ctx.service.assetWorkspace.syncAssetRequirements(
      storyboard.project_id,
      storyboard.chapter_id,
    );
    return await this.findById(storyboardId);
  }

  async clearMedia(storyboardId: number, mediaType: string) {
    if (mediaType === MEDIA_TYPE.COVER) {
      await this.update(storyboardId, { thumbnail_url: '', thumbnail_preview_url: '' });
    } else if (mediaType === MEDIA_TYPE.VIDEO) {
      await this.update(storyboardId, {
        video_url: '',
        video_preview_url: '',
        video_status: '',
        video_error: '',
        video_duration: null,
      });
    }
    return await this.findById(storyboardId);
  }

  async listSceneVideoInputs(sceneId: number) {
    const items = await this.findBySceneId(sceneId);
    return items
      .filter((item) => item.video_status === GENERATION_STATUS.SUCCEEDED && item.video_url)
      .sort((a, b) => a.sort_order - b.sort_order || a.shot_number - b.shot_number)
      .map((item) => ({
        source: item.video_url,
        duration: item.video_duration || item.duration || 5,
      }));
  }
}

module.exports = StoryboardService;
