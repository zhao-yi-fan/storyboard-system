// @ts-nocheck
'use strict';

const Service = require('egg').Service;
const path = require('node:path');
const { mapStoryboard } = require('../lib/entity');
const {
  sanitizeFileName,
  storyboardPreviewSpec,
  downloadAndStore,
  composeVideos,
  createPreviewFromLocalPath,
  materializeSourceToLocalFile,
  probeDuration,
  resolveMediaUrl,
} = require('../lib/media');
const { resolveUrl } = require('../lib/generated_asset');
const {
  generateWanxImage,
  generateWanxImageWithReferences,
  generateSeedreamImage,
  generateWanxVideo,
  generateSeedanceVideo,
} = require('../lib/ai_clients');
const { normalizeGeneratedAssetReference } = require('../lib/generated_asset');
const {
  buildStoryboardCoverPrompt,
  buildStoryboardVideoPrompt,
  buildPromptDisplayBlocks,
  buildPromptDisplayTokens,
} = require('../lib/prompt_library');

class StoryboardService extends Service {
  static SCENE_BACKGROUND_USAGE = 'scene_background';
  static SEEDANCE_VIDEO_MODEL = 'seedance-2.0';
  static SEEDANCE_MAX_REFERENCE_AUDIO_COUNT = 3;
  static SEEDANCE_MIN_REFERENCE_AUDIO_SECONDS = 2;
  static SEEDANCE_MAX_REFERENCE_AUDIO_SECONDS = 15;
  static SEEDANCE_MAX_REFERENCE_AUDIO_TOTAL_SECONDS = 15;

  get pool() {
    return this.app.mysqlPool;
  }

  async findSceneById(id) {
    const [rows] = await this.pool.query(
      'SELECT id, chapter_id, project_id FROM scenes WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    return rows[0] || null;
  }

  async findBySceneId(sceneId) {
    const scene = await this.findSceneById(sceneId);
    if (!scene) {
      throw new Error('scene not found');
    }

    const [rows] = await this.pool.query(
      `SELECT id, scene_id, chapter_id, project_id, shot_number, content, dialogue, shot_type, mood, style_preset, style_notes,
              camera_direction, camera_motion, duration, background, thumbnail_url, thumbnail_preview_url, video_url,
              video_preview_url, video_status, video_error, video_duration, notes, sort_order, created_at, updated_at
       FROM storyboards
       WHERE scene_id = ? AND deleted_at IS NULL
       ORDER BY sort_order ASC, id ASC`,
      [sceneId],
    );

    const items = rows.map((row) => mapStoryboard(this.app, row));
    await this.attachCharacters(items);
    await this.attachAssets(items);
    return items;
  }

  async findById(id) {
    const [rows] = await this.pool.query(
      `SELECT id, scene_id, chapter_id, project_id, shot_number, content, dialogue, shot_type, mood, style_preset, style_notes,
              camera_direction, camera_motion, duration, background, thumbnail_url, thumbnail_preview_url, video_url,
              video_preview_url, video_status, video_error, video_duration, notes, sort_order, created_at, updated_at
       FROM storyboards
       WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );

    if (!rows.length) {
      return null;
    }
    const item = mapStoryboard(this.app, rows[0]);
    await this.attachCharacters([item]);
    await this.attachAssets([item]);
    return item;
  }

  async getMaxSortOrder(sceneId) {
    const [rows] = await this.pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM storyboards WHERE scene_id = ? AND deleted_at IS NULL',
      [sceneId],
    );
    return Number(rows[0]?.max_sort || 0);
  }

  async create(sceneId, payload) {
    const scene = await this.findSceneById(sceneId);
    if (!scene) {
      throw new Error('scene not found');
    }

    const content = String(payload.content || '').trim();
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
        payload.duration == null || payload.duration === '' ? null : Number(payload.duration),
        String(payload.background || ''),
        String(payload.thumbnail_url || ''),
        String(payload.thumbnail_preview_url || ''),
        String(payload.notes || ''),
        sortOrder,
      ],
    );

    return await this.findById(result.insertId);
  }

  async update(id, payload) {
    const current = await this.findById(id);
    if (!current) {
      throw new Error('storyboard not found');
    }

    const content = Object.prototype.hasOwnProperty.call(payload, 'content')
      ? String(payload.content || '').trim()
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
          ? payload.duration == null || payload.duration === ''
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
          ? payload.video_duration == null || payload.video_duration === ''
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

  async softDelete(id) {
    await this.pool.execute('UPDATE storyboards SET deleted_at = NOW() WHERE id = ?', [id]);
  }

  async attachCharacters(items) {
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

  async attachAssets(items) {
    if (!items.length) {
      return;
    }
    const ids = items.map((item) => item.id);
    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await this.pool.query(
      `SELECT sau.storyboard_id, a.id, a.project_id, a.character_id, a.name, a.type, a.file_url, a.cover_url, a.thumbnail_url, a.meta, a.created_at, a.updated_at
       FROM storyboard_asset_usages sau
       JOIN assets a ON a.id = sau.asset_id
       WHERE sau.storyboard_id IN (${placeholders}) AND sau.usage_type = ? AND a.deleted_at IS NULL
       ORDER BY sau.storyboard_id ASC, a.id ASC`,
      [...ids, StoryboardService.SCENE_BACKGROUND_USAGE],
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

  supportedCoverModels() {
    return new Set(['', 'auto', 'wan2.7-image-pro', 'seedream-4.5']);
  }

  supportedVideoModels() {
    return new Set(['wan2.7-i2v', StoryboardService.SEEDANCE_VIDEO_MODEL]);
  }

  isSeedanceVideoModel(model) {
    return String(model || '').trim() === StoryboardService.SEEDANCE_VIDEO_MODEL;
  }

  resolveStoryboardStylePreset(scene, storyboard) {
    return String(storyboard.style_preset || scene.style_preset || '').trim();
  }

  resolveStoryboardStyleNotes(scene, storyboard) {
    return String(storyboard.style_notes || scene.style_notes || '').trim();
  }

  buildCoverPrompt(fields, references) {
    return buildStoryboardCoverPrompt(fields, references).prompt;
  }

  buildVideoPrompt(storyboard, scene, duration) {
    return buildStoryboardVideoPrompt(
      {
        ...storyboard,
        style_preset: this.resolveStoryboardStylePreset(scene, storyboard),
        style_notes: this.resolveStoryboardStyleNotes(scene, storyboard),
      },
      scene,
      duration,
    ).prompt;
  }

  parseUseFirstFrame(value) {
    if (typeof value === 'boolean') {
      return value;
    }
    const normalized = String(value == null ? 'true' : value)
      .trim()
      .toLowerCase();
    return normalized !== 'false' && normalized !== '0' && normalized !== 'off';
  }

  async selectSceneReferenceImages(storyboard, scene) {
    const references = [];
    const missing = [];
    for (const asset of Array.isArray(storyboard.assets) ? storyboard.assets : []) {
      const url = resolveUrl(
        this.app,
        asset.cover_url || asset.file_url,
        this.app.config.storyboard.publicAppBaseUrl || '',
      );
      if (url) {
        references.push({
          asset_id: Number(asset.id),
          type: 'scene',
          name: String(asset.name || '').trim(),
          url,
          source: asset.cover_url ? 'asset.cover_url' : 'asset.file_url',
        });
      }
    }
    if (!references.length) {
      missing.push('scene-background');
    }
    return { references, missing };
  }

  async selectReferenceImages(storyboard, scene) {
    const { references, missing } = await this.selectSceneReferenceImages(storyboard, scene);
    for (const character of storyboard.characters.slice(0, 2)) {
      const url = resolveUrl(
        this.app,
        character.design_sheet_url,
        this.app.config.storyboard.publicAppBaseUrl || '',
      );
      if (!url) {
        missing.push(`character:${character.name}`);
        continue;
      }
      references.push({
        asset_id: Number(character.id),
        type: 'character',
        name: character.name,
        url,
        source: 'character.design_sheet_url',
      });
    }
    return { references, missing };
  }

  selectVideoCharacterReferenceImages(storyboard) {
    const references = [];
    const missing = [];
    for (const character of storyboard.characters.slice(0, 2)) {
      const url = resolveUrl(
        this.app,
        character.design_sheet_url,
        this.app.config.storyboard.publicAppBaseUrl || '',
      );
      if (!url) {
        missing.push(`character:${character.name}`);
        continue;
      }
      references.push({
        asset_id: Number(character.id),
        type: 'character',
        name: character.name,
        url,
        source: 'character.design_sheet_url',
      });
    }
    return { references, missing };
  }

  async selectVideoReferenceImages(storyboard, scene) {
    const { references: sceneReferences, missing: sceneMissing } =
      await this.selectSceneReferenceImages(storyboard, scene);
    const { references: characterReferences, missing: characterMissing } =
      this.selectVideoCharacterReferenceImages(storyboard);
    return {
      references: [...sceneReferences, ...characterReferences],
      missing: [...sceneMissing, ...characterMissing],
    };
  }

  async resolveVoiceReferenceDuration(character, url) {
    const storedDuration = Number(character.voice_reference_duration || 0) || 0;
    if (storedDuration > 0) {
      return storedDuration;
    }
    let materialized;
    try {
      materialized = await materializeSourceToLocalFile(this.app, url, '.audio');
      const duration = await probeDuration(materialized.localPath);
      if (duration > 0) {
        await this.pool.execute('UPDATE characters SET voice_reference_duration = ? WHERE id = ?', [
          duration,
          Number(character.id),
        ]);
      }
      return duration;
    } catch (error) {
      this.ctx.logger.warn(
        '[seedance] failed to probe voice reference duration character=%s: %s',
        character.id,
        error.message,
      );
      return 0;
    } finally {
      if (materialized) {
        await materialized.cleanup();
      }
    }
  }

  async selectVideoAudioReferences(storyboard, useFirstFrame) {
    const references = [];
    const missing = [];
    const blockingReasons = [];
    for (const character of Array.isArray(storyboard.characters) ? storyboard.characters : []) {
      const url = resolveUrl(
        this.app,
        character.voice_reference_url,
        this.app.config.storyboard.publicAppBaseUrl || '',
      );
      if (!url) {
        missing.push(character.name);
        continue;
      }
      references.push({
        character_id: Number(character.id),
        type: 'character',
        name: character.name,
        url,
        source: 'character.voice_reference_url',
        duration: await this.resolveVoiceReferenceDuration(character, url),
        voice_name: String(character.voice_name || '').trim(),
      });
    }
    if (missing.length) {
      blockingReasons.push(`以下角色缺少主语音参考：${missing.join('、')}`);
    }
    if (references.length > StoryboardService.SEEDANCE_MAX_REFERENCE_AUDIO_COUNT) {
      blockingReasons.push(
        `Seedance 2.0 最多支持 ${StoryboardService.SEEDANCE_MAX_REFERENCE_AUDIO_COUNT} 段参考音频，当前为 ${references.length} 段`,
      );
    }
    const invalidDurationReferences = references.filter(
      (item) =>
        item.duration < StoryboardService.SEEDANCE_MIN_REFERENCE_AUDIO_SECONDS ||
        item.duration > StoryboardService.SEEDANCE_MAX_REFERENCE_AUDIO_SECONDS,
    );
    if (invalidDurationReferences.length) {
      blockingReasons.push(
        `以下角色主语音时长不在 2-15 秒范围内：${invalidDurationReferences.map((item) => `${item.name}${item.duration ? `(${item.duration.toFixed(1)}s)` : '(未知时长)'}`).join('、')}`,
      );
    }
    const totalDuration = references.reduce((sum, item) => sum + item.duration, 0);
    if (totalDuration > StoryboardService.SEEDANCE_MAX_REFERENCE_AUDIO_TOTAL_SECONDS) {
      blockingReasons.push(
        `Seedance 2.0 参考音频总时长不能超过 15 秒，当前为 ${totalDuration.toFixed(1)} 秒`,
      );
    }
    if (references.length && !useFirstFrame) {
      blockingReasons.push('Seedance 2.0 传入角色参考音频时必须同时使用首帧图');
    }
    return {
      references,
      missing,
      totalDuration,
      blockingReasons,
      limits: {
        max_count: StoryboardService.SEEDANCE_MAX_REFERENCE_AUDIO_COUNT,
        min_duration: StoryboardService.SEEDANCE_MIN_REFERENCE_AUDIO_SECONDS,
        max_duration: StoryboardService.SEEDANCE_MAX_REFERENCE_AUDIO_SECONDS,
        max_total_duration: StoryboardService.SEEDANCE_MAX_REFERENCE_AUDIO_TOTAL_SECONDS,
        formats: ['wav', 'mp3'],
      },
    };
  }

  async addCharacter(storyboardId, characterId) {
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
    return await this.findById(storyboardId);
  }

  async removeCharacter(storyboardId, characterId) {
    const storyboard = await this.findById(storyboardId);
    if (!storyboard) {
      throw new Error('storyboard not found');
    }
    await this.pool.execute(
      'DELETE FROM storyboard_characters WHERE storyboard_id = ? AND character_id = ?',
      [storyboardId, characterId],
    );
    return await this.findById(storyboardId);
  }

  async addAsset(storyboardId, assetId) {
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
    const type = String(asset.type || '')
      .trim()
      .toLowerCase();
    if (
      !(
        type.includes('scene') ||
        type.includes('background') ||
        type.includes('场景') ||
        type.includes('背景')
      )
    ) {
      throw new Error('当前资产不是场景背景资产');
    }
    await this.pool.execute(
      `INSERT INTO storyboard_asset_usages (storyboard_id, asset_id, usage_type)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE usage_type = VALUES(usage_type)`,
      [storyboardId, assetId, StoryboardService.SCENE_BACKGROUND_USAGE],
    );
    return await this.findById(storyboardId);
  }

  async removeAsset(storyboardId, assetId) {
    const storyboard = await this.findById(storyboardId);
    if (!storyboard) {
      throw new Error('storyboard not found');
    }
    await this.pool.execute(
      'DELETE FROM storyboard_asset_usages WHERE storyboard_id = ? AND asset_id = ? AND usage_type = ?',
      [storyboardId, assetId, StoryboardService.SCENE_BACKGROUND_USAGE],
    );
    return await this.findById(storyboardId);
  }

  async previewCoverGeneration(id, selectedModel) {
    if (!this.supportedCoverModels().has(String(selectedModel || '').trim())) {
      throw new Error('unsupported cover model');
    }
    const storyboard = await this.findById(id);
    if (!storyboard) {
      throw new Error('storyboard not found');
    }
    const scene = await this.ctx.service.scene.findById(storyboard.scene_id);
    if (!scene) {
      throw new Error('scene not found');
    }
    const { references, missing } = await this.selectReferenceImages(storyboard, scene);
    const model =
      String(selectedModel || '').trim() ||
      (references.length
        ? this.app.config.storyboard.wanxReferenceModel || 'wan2.7-image-pro'
        : this.app.config.storyboard.wanxModel || 'wan2.7-image-pro');
    const mode = references.length ? 'reference' : 'text-only';
    const fields = {
      scene_title: String(scene.title || '').trim(),
      location: String(scene.location || '').trim(),
      time_of_day: String(scene.time_of_day || '').trim(),
      background: String(storyboard.background || '').trim(),
      characters: storyboard.character_names.slice(),
      shot_type: String(storyboard.shot_type || '').trim(),
      camera_direction: String(storyboard.camera_direction || '').trim(),
      content: String(storyboard.content || '').trim(),
      mood: String(storyboard.mood || '').trim(),
      style_preset: this.resolveStoryboardStylePreset(scene, storyboard),
      style_notes: this.resolveStoryboardStyleNotes(scene, storyboard),
      dialogue: String(storyboard.dialogue || '').trim(),
      notes: String(storyboard.notes || '').trim(),
    };
    const coverPrompt = buildStoryboardCoverPrompt(fields, references);
    return {
      mode,
      model,
      reference_images: references.map((item) => ({
        type: item.type,
        name: item.name,
        url: item.url,
        source: item.source,
      })),
      missing_references: missing,
      fields,
      template: coverPrompt.template,
      prompt_blueprint: coverPrompt.blueprint,
      final_prompt: coverPrompt.prompt,
      can_generate_without_references: true,
    };
  }

  async generateCover(id, selectedModel, useTextOnly) {
    const preview = await this.previewCoverGeneration(id, selectedModel);
    const storyboard = await this.findById(id);
    const generation = await this.ctx.service.mediaGeneration.create({
      storyboard_id: id,
      media_type: 'cover',
      model: preview.model,
      status: 'generating',
      source_url: preview.reference_images[0]?.url || null,
      meta_json: JSON.stringify({
        resolution: '1024x576',
        preview_format: 'webp',
        preview_width: 480,
        reference_count: preview.reference_images.length,
        reference_types: preview.reference_images.map((item) => item.type),
        generation_mode: useTextOnly ? 'text-only' : preview.mode,
      }),
    });

    try {
      let imageUrl;
      if (
        preview.model === 'seedream-4.5' ||
        preview.model ===
          (this.app.config.storyboard.seedreamImageModel || 'doubao-seedream-4-5-251128')
      ) {
        imageUrl = await generateSeedreamImage(
          this.app,
          preview.final_prompt,
          useTextOnly ? [] : preview.reference_images.map((item) => item.url),
        );
      } else if (!useTextOnly && preview.reference_images.length) {
        imageUrl = await generateWanxImageWithReferences(
          this.app,
          preview.final_prompt,
          preview.reference_images.map((item) => item.url),
          preview.model,
        );
      } else {
        imageUrl = await generateWanxImage(this.app, preview.final_prompt, preview.model);
      }
      const filename = `${sanitizeFileName(`storyboard-${id}`)}-${Date.now()}.png`;
      const stored = await downloadAndStore(this.app, imageUrl, 'covers', filename, 'image/png');
      const previewFilename = `${path.basename(filename, path.extname(filename))}.thumb.webp`;
      const previewPath = await createPreviewFromLocalPath(
        this.app,
        stored.localPath,
        'covers',
        previewFilename,
        storyboardPreviewSpec(),
      );

      await this.update(id, {
        thumbnail_url: stored.publicPath,
        thumbnail_preview_url: previewPath,
      });

      await this.ctx.service.mediaGeneration.update(generation.id, {
        status: 'succeeded',
        result_url: stored.publicPath,
        preview_url: previewPath,
        error_message: null,
      });
      await this.ctx.service.mediaGeneration.markCurrent(id, 'cover', generation.id);

      const storyboardAfter = await this.findById(id);
      return {
        storyboard_id: storyboardAfter.id,
        thumbnail_url: storyboardAfter.thumbnail_url,
        thumbnail_preview_url: storyboardAfter.thumbnail_preview_url,
        storyboard: storyboardAfter,
      };
    } catch (error) {
      await this.ctx.service.mediaGeneration.update(generation.id, {
        status: 'failed',
        error_message: error.message,
      });
      throw error;
    }
  }

  async uploadCover(id, thumbnailUrl) {
    const storyboard = await this.findById(id);
    if (!storyboard) {
      throw new Error('storyboard not found');
    }
    const normalizedThumbnailUrl = normalizeGeneratedAssetReference(
      this.app,
      String(thumbnailUrl || '').trim(),
    );
    if (!normalizedThumbnailUrl) {
      throw new Error('thumbnail_url is required');
    }

    const generation = await this.ctx.service.mediaGeneration.create({
      storyboard_id: id,
      media_type: 'cover',
      model: 'manual-upload',
      status: 'succeeded',
      result_url: normalizedThumbnailUrl,
      preview_url: normalizedThumbnailUrl,
      source_url: normalizedThumbnailUrl,
      is_current: false,
      meta_json: JSON.stringify({ source: 'manual-upload' }),
    });
    await this.ctx.service.mediaGeneration.markCurrent(id, 'cover', generation.id);
    const nextStoryboard = await this.applyMediaGeneration(id, generation);
    return {
      storyboard: nextStoryboard,
      media_generations: await this.ctx.service.mediaGeneration.listByStoryboardId(id),
    };
  }

  async previewVideoGeneration(id, selectedModel, duration, useFirstFrameRaw) {
    const storyboard = await this.findById(id);
    if (!storyboard) {
      throw new Error('storyboard not found');
    }
    const scene = await this.ctx.service.scene.findById(storyboard.scene_id);
    if (!scene) {
      throw new Error('scene not found');
    }
    const model =
      String(selectedModel || '').trim() ||
      this.app.config.storyboard.wanxVideoModel ||
      'wan2.7-i2v';
    if (!this.supportedVideoModels().has(model)) {
      throw new Error('unsupported video model');
    }
    const selectedDuration = Number(duration || 5) || 5;
    const useFirstFrame = this.parseUseFirstFrame(useFirstFrameRaw);
    const isSeedance = this.isSeedanceVideoModel(model);
    if (isSeedance && selectedDuration !== 5) {
      throw new Error('当前 Seedance 2.0 视频生成仅支持 5 秒输出');
    }
    if (!isSeedance && selectedDuration !== 5) {
      throw new Error('当前视频模型仅支持 5 秒输出');
    }
    const sourceImageUrl =
      useFirstFrame && storyboard.thumbnail_url
        ? resolveMediaUrl(this.app, storyboard.thumbnail_url)
        : '';
    const { references: referenceImages, missing: missingReferences } =
      await this.selectVideoReferenceImages(storyboard, scene);
    const audioReferenceSummary = isSeedance
      ? await this.selectVideoAudioReferences(storyboard, useFirstFrame)
      : { references: [], missing: [], totalDuration: 0, blockingReasons: [], limits: null };
    const videoPrompt = buildStoryboardVideoPrompt(
      {
        ...storyboard,
        style_preset: this.resolveStoryboardStylePreset(scene, storyboard),
        style_notes: this.resolveStoryboardStyleNotes(scene, storyboard),
      },
      scene,
      selectedDuration,
    );
    return {
      model,
      duration: selectedDuration,
      resolution: isSeedance ? '480p' : '720P',
      audio: true,
      use_first_frame: useFirstFrame,
      source_image_url: sourceImageUrl,
      source_image_status: !useFirstFrame
        ? 'not-required'
        : sourceImageUrl
          ? 'existing-cover'
          : 'will-generate-cover',
      will_generate_cover: useFirstFrame && !sourceImageUrl,
      reference_images: referenceImages.map((item) => ({
        type: item.type,
        name: item.name,
        url: item.url,
        source: item.source,
      })),
      missing_references: missingReferences,
      audio_reference_assets: audioReferenceSummary.references.map((item) => ({
        character_id: item.character_id,
        type: item.type,
        name: item.name,
        url: item.url,
        source: item.source,
        duration: item.duration,
        voice_name: item.voice_name,
      })),
      missing_audio_references: audioReferenceSummary.missing,
      audio_reference_total_duration: audioReferenceSummary.totalDuration,
      audio_reference_limits: audioReferenceSummary.limits,
      blocking_reasons: audioReferenceSummary.blockingReasons,
      fields: {
        scene_title: String(scene.title || '').trim(),
        background: String(storyboard.background || '').trim(),
        characters: storyboard.character_names.slice(),
        content: String(storyboard.content || '').trim(),
        mood: String(storyboard.mood || '').trim(),
        style_preset: this.resolveStoryboardStylePreset(scene, storyboard),
        style_notes: this.resolveStoryboardStyleNotes(scene, storyboard),
        dialogue: String(storyboard.dialogue || '').trim(),
        notes: String(storyboard.notes || '').trim(),
      },
      video_fields: {
        shot_type: String(storyboard.shot_type || '').trim(),
        camera_direction: String(storyboard.camera_direction || '').trim(),
        camera_motion: String(storyboard.camera_motion || '').trim(),
        duration: selectedDuration,
      },
      template: videoPrompt.template,
      prompt_blueprint: videoPrompt.blueprint,
      prompt_display_blocks: buildPromptDisplayBlocks(videoPrompt.blueprint),
      prompt_display_tokens: buildPromptDisplayTokens({
        finalPrompt: videoPrompt.prompt,
        sceneTitle: scene.title,
        characters: storyboard.character_names,
        stylePreset: this.resolveStoryboardStylePreset(scene, storyboard),
        cameraDirection: storyboard.camera_direction,
        cameraMotion: storyboard.camera_motion,
        audio: true,
        useFirstFrame,
        hasSourceImage: !!sourceImageUrl,
        timeline: videoPrompt.blueprint.timeline,
        characters: storyboard.character_names,
      }),
      final_prompt: videoPrompt.prompt,
    };
  }

  async generateVideo(id, selectedModel, duration, useFirstFrameRaw) {
    const preview = await this.previewVideoGeneration(
      id,
      selectedModel,
      duration,
      useFirstFrameRaw,
    );
    if (Array.isArray(preview.blocking_reasons) && preview.blocking_reasons.length) {
      throw new Error(preview.blocking_reasons.join('；'));
    }
    const current = await this.findById(id);
    if (current.video_status === 'generating') {
      return {
        storyboard_id: current.id,
        video_url: current.video_url,
        video_preview_url: current.video_preview_url,
        storyboard: current,
      };
    }
    const generation = await this.ctx.service.mediaGeneration.create({
      storyboard_id: id,
      media_type: 'video',
      model: preview.model,
      status: 'generating',
      source_url: preview.use_first_frame ? current.thumbnail_url || null : null,
      meta_json: JSON.stringify({
        resolution: preview.resolution,
        duration: preview.duration,
        audio: true,
        use_first_frame: preview.use_first_frame,
        audio_reference_count: preview.audio_reference_assets?.length || 0,
        audio_reference_characters: (preview.audio_reference_assets || []).map((item) => item.name),
        audio_reference_total_duration: preview.audio_reference_total_duration || 0,
      }),
    });

    await this.update(id, {
      video_status: 'generating',
      video_error: '',
    });

    void this.generateVideoAsync(id, preview, generation.id).catch((err) =>
      this.ctx.logger.error(err),
    );
    const refreshed = await this.findById(id);
    return {
      storyboard_id: refreshed.id,
      video_url: refreshed.video_url,
      video_preview_url: refreshed.video_preview_url,
      storyboard: refreshed,
    };
  }

  async generateVideoAsync(id, preview, generationId) {
    const generation = await this.ctx.service.mediaGeneration.findById(generationId);
    let storyboard = await this.findById(id);
    try {
      if (preview.use_first_frame && !storyboard.thumbnail_url) {
        await this.generateCover(id, '', false);
        storyboard = await this.findById(id);
      }
      const imageInput = preview.use_first_frame
        ? resolveMediaUrl(this.app, storyboard.thumbnail_url)
        : '';
      if (preview.use_first_frame && !imageInput) {
        throw new Error('镜头封面图不可用，无法生成视频');
      }
      const scene = await this.ctx.service.scene.findById(storyboard.scene_id);
      const prompt = this.buildVideoPrompt(storyboard, scene, preview.duration);
      const result = this.isSeedanceVideoModel(preview.model)
        ? await generateSeedanceVideo(
            this.app,
            prompt,
            imageInput,
            preview.duration,
            preview.use_first_frame,
            [],
            (preview.audio_reference_assets || []).map((item) => item.url),
          )
        : await generateWanxVideo(
            this.app,
            prompt,
            imageInput,
            preview.model,
            preview.duration,
            preview.use_first_frame,
          );
      const filename = `${sanitizeFileName(`storyboard-${id}`)}-${Date.now()}.mp4`;
      const stored = await downloadAndStore(
        this.app,
        result.videoUrl,
        'videos',
        filename,
        'video/mp4',
      );
      await this.update(id, {
        video_url: stored.publicPath,
        video_preview_url: stored.publicPath,
        video_status: 'succeeded',
        video_error: '',
        video_duration: result.duration,
        duration: result.duration,
      });
      await this.ctx.service.mediaGeneration.update(generation.id, {
        status: 'succeeded',
        result_url: stored.publicPath,
        preview_url: stored.publicPath,
        source_url: preview.use_first_frame ? storyboard.thumbnail_url : '',
        error_message: null,
        meta_json: JSON.stringify({
          resolution: preview.resolution,
          duration: result.duration,
          audio: true,
          use_first_frame: preview.use_first_frame,
          audio_reference_count: preview.audio_reference_assets?.length || 0,
          audio_reference_characters: (preview.audio_reference_assets || []).map(
            (item) => item.name,
          ),
          audio_reference_total_duration: preview.audio_reference_total_duration || 0,
        }),
      });
      await this.ctx.service.mediaGeneration.markCurrent(id, 'video', generation.id);
    } catch (error) {
      await this.update(id, {
        video_url: '',
        video_preview_url: '',
        video_status: 'failed',
        video_error: error.message,
      });
      await this.ctx.service.mediaGeneration.update(generation.id, {
        status: 'failed',
        error_message: error.message,
      });
    }
  }

  async applyMediaGeneration(storyboardId, generation) {
    if (!generation) {
      return await this.findById(storyboardId);
    }
    if (generation.media_type === 'cover') {
      await this.update(storyboardId, {
        thumbnail_url: generation.result_url || '',
        thumbnail_preview_url: generation.preview_url || '',
      });
    } else if (generation.media_type === 'video') {
      const meta = generation.meta_json ? JSON.parse(generation.meta_json) : {};
      await this.update(storyboardId, {
        video_url: generation.result_url || '',
        video_preview_url: generation.preview_url || '',
        video_status: generation.result_url ? 'succeeded' : '',
        video_error: '',
        video_duration: Number(meta.duration || 0) || 0,
      });
    }
    return await this.findById(storyboardId);
  }

  async clearMedia(storyboardId, mediaType) {
    if (mediaType === 'cover') {
      await this.update(storyboardId, { thumbnail_url: '', thumbnail_preview_url: '' });
    } else if (mediaType === 'video') {
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

  async listSceneVideoInputs(sceneId) {
    const items = await this.findBySceneId(sceneId);
    return items
      .filter((item) => item.video_status === 'succeeded' && item.video_url)
      .sort((a, b) => a.sort_order - b.sort_order || a.shot_number - b.shot_number)
      .map((item) => ({
        source: item.video_url,
        duration: item.video_duration || item.duration || 5,
      }));
  }
}

module.exports = StoryboardService;
