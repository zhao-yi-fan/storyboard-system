'use strict';
// @ts-nocheck

const Service = require('egg').Service;
const path = require('node:path');
const { mapScene } = require('../lib/entity');
const {
  sanitizeFileName,
  storyboardPreviewSpec,
  downloadAndStore,
  createPreviewFromLocalPath,
  composeVideos,
  resolveMediaUrl,
} = require('../lib/media');
const {
  generateSeedreamImage,
  generateWanxVideo,
  generateSeedanceVideo,
} = require('../lib/ai_clients');
const { normalizeGeneratedAssetReference } = require('../lib/generated_asset');
const { parseMediaGenerationMeta } = require('../lib/media_generation_meta');
const {
  assertCompositePromptLength,
  buildCompositeVideoPrompt,
  extractFirstShotCoverPrompt,
} = require('../lib/composite_prompt');
const { optimizeStoryboardPrompt } = require('../lib/prompt_optimizer');
const { optimizeSceneDescription } = require('../lib/scene_description_optimizer');
const { SceneRepository } = require('../repository/scene_repository');
const {
  GENERATION_STATUS,
  MEDIA_TYPE,
  VIDEO_MODEL,
} = require('../lib/domain_constants');

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
  async findChapterById(id) {
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
  async findByChapterId(chapterId) {
    const chapter = await this.findChapterById(chapterId);
    if (!chapter) {
      throw new Error('chapter not found');
    }

    const rows = await this.repository.findByChapterId(chapterId);

    const items = rows.map((row) => mapScene(this.app, row));
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
  async findById(id) {
    const row = await this.repository.findById(id);
    if (!row) return null;
    const item = mapScene(this.app, row);
    await this.attachCharacters([item]);
    await this.attachAssets([item]);
    await this.attachVideoFrameReferences([item]);
    return item;
  }

  async attachVideoFrameReferences(items) {
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
  async getMaxSortOrder(chapterId) {
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
  async create(chapterId, payload) {
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
  async update(id, payload) {
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
          ? payload.video_duration == null || payload.video_duration === ''
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

  async optimizePrompt(id, payload) {
    const scene = await this.findById(id);
    if (!scene) {
      throw new Error('scene not found');
    }

    return await optimizeStoryboardPrompt(this.config.storyboard, payload.prompt, {
      title: scene.title,
      duration: scene.generation_duration,
    });
  }

  async optimizeDescription(payload) {
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
  async softDelete(id) {
    await this.pool.execute('UPDATE scenes SET deleted_at = NOW() WHERE id = ?', [id]);
  }

  async attachCharacters(items) {
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
      const target: any = byScene.get(Number(row.scene_id));
      if (!target) continue;
      const character = this.ctx.service.character.map(row);
      target.characters.push(character);
      target.character_names.push(character.name);
    }
  }

  async attachAssets(items) {
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
      const target: any = byScene.get(Number(row.scene_id));
      if (!target) continue;
      const asset = this.ctx.service.asset.map(row);
      target.assets.push(asset);
      target.asset_names.push(asset.name);
    }
  }

  async addCharacter(sceneId, characterId) {
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
    await this.ctx.service.assetWorkspace.syncAssetRequirements(scene.project_id, scene.chapter_id);
    return await this.findById(sceneId);
  }

  async removeCharacter(sceneId, characterId) {
    const scene = await this.findById(sceneId);
    if (!scene) throw new Error('scene not found');
    await this.pool.execute(
      'DELETE FROM scene_characters WHERE scene_id = ? AND character_id = ?',
      [sceneId, characterId],
    );
    await this.ctx.service.assetWorkspace.syncAssetRequirements(scene.project_id, scene.chapter_id);
    return await this.findById(sceneId);
  }

  async addAsset(sceneId, assetId) {
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
    await this.ctx.service.assetWorkspace.syncAssetRequirements(scene.project_id, scene.chapter_id);
    return await this.findById(sceneId);
  }

  async removeAsset(sceneId, assetId) {
    const scene = await this.findById(sceneId);
    if (!scene) throw new Error('scene not found');
    await this.pool.execute('DELETE FROM scene_asset_usages WHERE scene_id = ? AND asset_id = ?', [
      sceneId,
      assetId,
    ]);
    await this.ctx.service.assetWorkspace.syncAssetRequirements(scene.project_id, scene.chapter_id);
    return await this.findById(sceneId);
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
  buildCoverPrompt(scene) {
    const prompt = assertCompositePromptLength(scene.prompt || scene.description || '');
    if (!prompt) throw new Error('片段 Prompt 不能为空');
    return extractFirstShotCoverPrompt(prompt);
  }

  buildGenerationReferenceState(scene, references, missing, projectReferenceNames = []) {
    const prompt = String(scene.prompt || scene.description || '');
    const boundNames = new Set(
      [
        ...(Array.isArray(scene.characters) ? scene.characters : []),
        ...(Array.isArray(scene.assets) ? scene.assets : []),
        ...(Array.isArray(scene.video_frame_references) ? scene.video_frame_references : []),
      ]
        .map((item) => String(item.name || '').trim())
        .filter(Boolean),
    );
    const typeLabels = {
      character: '角色主设定图',
      scene: '场景参考图',
      prop: '道具参考图',
      costume: '服装参考图',
      asset: '图片参考',
      video_frame: '视频抽帧',
    };
    const mappings = references.map((reference, index) => {
      const name = String(reference.name || '').trim();
      const mention = name ? `@${name}` : '';
      const isMentioned = !!mention && prompt.includes(mention);
      const subject = `${typeLabels[reference.type] || '图片参考'}「${name}」`;
      return {
        index: index + 1,
        name,
        type: reference.type,
        source: reference.source,
        mention,
        is_mentioned: isMentioned,
        prompt_text: isMentioned
          ? `参考图${index + 1}：${subject}，对应 Prompt 中的 ${mention}。`
          : `参考图${index + 1}：${subject}，作为当前片段已绑定的视觉参考。`,
      };
    });
    const boundWithoutMentions = mappings
      .filter((mapping) => !mapping.is_mentioned)
      .map((mapping) => mapping.name);
    const knownNames = Array.from(
      new Set(projectReferenceNames.map((name) => String(name || '').trim()).filter(Boolean)),
    );
    const unboundMentions = knownNames.filter(
      (name) => prompt.includes(`@${name}`) && !boundNames.has(name),
    );

    return {
      reference_images: references,
      missing_references: missing,
      mappings,
      bound_without_mentions: boundWithoutMentions,
      unbound_mentions: unboundMentions,
      recognized_bound_mentions: Array.from(boundNames).filter((name) =>
        prompt.includes(`@${name}`),
      ),
    };
  }

  async generationReferencesForScene(scene) {
    const [{ references, missing }, characters, assets] = await Promise.all([
      this.ctx.service.storyboard.selectReferenceImages(scene, scene),
      this.ctx.service.character.findByProjectId(scene.project_id),
      this.ctx.service.asset.findByProjectId(scene.project_id),
    ]);
    const frameReferences = this.buildVideoFrameReferences(scene.video_frame_references || []);
    return this.buildGenerationReferenceState(
      scene,
      [...references, ...frameReferences],
      missing,
      [...characters, ...assets].map((item) => item.name),
    );
  }

  buildVideoFrameReferences(frames) {
    return frames.map((frame) => {
      const seconds = (Number(frame.timestamp_ms || 0) / 1000).toFixed(1);
      const sceneTitle = String(frame.source_scene_title || `片段${frame.source_scene_id}`);
      return {
        type: 'video_frame',
        name: `${sceneTitle} ${seconds}s 抽帧`,
        url: frame.file_url,
        source: `来源片段「${sceneTitle}」的视频版本 #${frame.source_generation_id}，时间点 ${seconds}s`,
        frame_id: frame.id,
      };
    });
  }

  async generationReferences(id) {
    const scene = await this.findById(id);
    if (!scene) throw new Error('scene not found');
    return await this.generationReferencesForScene(scene);
  }

  buildReferenceMappedPrompt(prompt, mappings) {
    if (!mappings.length) return prompt;
    return `【参考图对应关系】\n${mappings.map((mapping) => mapping.prompt_text).join('\n')}\n\n${prompt}`;
  }

  /**
   * 预览场景封面生成参数和 prompt。
   * @param {number} id 场景 id，例如 `21`。
   * @returns {Promise<object>} 预览信息，包含字段摘要、模板和最终 prompt。
   * @example
   * await service.previewCoverGeneration(21)
   * // => { action: "scene-cover", model: "seedream-4.5", final_prompt: "..." }
   */
  async previewCoverGeneration(id, _selectedModel = '') {
    const scene = await this.findById(id);
    if (!scene) {
      throw new Error('scene not found');
    }
    const prompt = this.buildCoverPrompt(scene);
    const referenceState = await this.generationReferencesForScene(scene);
    const finalPrompt = this.buildReferenceMappedPrompt(prompt, referenceState.mappings);
    return {
      prompt_mode: 'composite',
      mode: referenceState.reference_images.length ? 'reference' : 'text-only',
      model: this.app.config.storyboard.seedreamImageModel || 'seedream-4.5',
      ...referenceState,
      fields: {
        scene_title: String(scene.title || '').trim(),
        location: String(scene.location || '').trim(),
        time_of_day: String(scene.time_of_day || '').trim(),
        content: String(scene.prompt || '').trim(),
        characters: scene.character_names || [],
      },
      template: 'composite-first-shot',
      prompt_blueprint: null,
      final_prompt: finalPrompt,
      can_generate_without_references: true,
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
  async generateCover(id, selectedModel = '', useTextOnly = false) {
    const scene = await this.findById(id);
    if (!scene) {
      throw new Error('scene not found');
    }
    const preview = await this.previewCoverGeneration(id, selectedModel);
    const generation = await this.ctx.service.sceneMediaGeneration.create({
      scene_id: id,
      media_type: MEDIA_TYPE.COVER,
      model: preview.model,
      status: GENERATION_STATUS.GENERATING,
      source_url: preview.reference_images[0]?.url || null,
      meta_json: JSON.stringify({
        prompt_mode: 'composite',
        reference_count: preview.reference_images.length,
        generation_mode: useTextOnly ? 'text-only' : preview.mode,
      }),
    });
    let stored;
    let previewPath;
    try {
      const imageUrl = await generateSeedreamImage(
        this.app,
        preview.final_prompt,
        useTextOnly ? [] : preview.reference_images.map((item) => item.url),
      );
      const filename = `${sanitizeFileName(`scene-${id}`)}-${Date.now()}.png`;
      stored = await downloadAndStore(this.app, imageUrl, 'scene-covers', filename, 'image/png');
      const previewFilename = `${path.basename(filename, path.extname(filename))}.thumb.webp`;
      previewPath = await createPreviewFromLocalPath(
        this.app,
        stored.localPath,
        'scene-covers',
        previewFilename,
        storyboardPreviewSpec(),
      );
      await this.update(id, { cover_url: stored.publicPath, cover_preview_url: previewPath });
      await this.ctx.service.sceneMediaGeneration.update(generation.id, {
        status: GENERATION_STATUS.SUCCEEDED,
        result_url: stored.publicPath,
        preview_url: previewPath,
        error_message: null,
      });
      await this.ctx.service.sceneMediaGeneration.markCurrent(id, MEDIA_TYPE.COVER, generation.id);
      return await this.findById(id);
    } catch (error) {
      await this.ctx.service.sceneMediaGeneration.update(generation.id, {
        status: GENERATION_STATUS.FAILED,
        error_message: error.message,
      });
      throw error;
    }
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

  async listMediaGenerations(id) {
    return await this.ctx.service.sceneMediaLibrary.list(id);
  }

  async applyMediaGeneration(id, generation) {
    if (!generation || Number(generation.scene_id) !== Number(id)) {
      throw new Error('scene media generation not found');
    }
    if (generation.media_type === MEDIA_TYPE.COVER) {
      return await this.update(id, {
        cover_url: generation.result_url || '',
        cover_preview_url: generation.preview_url || generation.result_url || '',
      });
    }
    if (generation.media_type === MEDIA_TYPE.VIDEO) {
      const posterUrl = await this.ctx.service.sceneVideoPoster.ensureBestEffort(generation);
      return await this.update(id, {
        video_url: generation.result_url || '',
        video_preview_url: generation.preview_url || generation.result_url || '',
        video_poster_url: posterUrl,
        video_status: generation.status || '',
        video_error: generation.error_message || '',
      });
    }
    throw new Error('unsupported media type');
  }

  async setMediaGenerationCurrent(id, generationId) {
    return await this.ctx.service.sceneMediaLibrary.setCurrent(id, generationId);
  }

  async deleteMediaGeneration(id, generationId) {
    return await this.ctx.service.sceneMediaLibrary.remove(id, generationId);
  }

  async uploadCover(id, coverUrl) {
    return await this.ctx.service.sceneMediaLibrary.uploadCover(id, coverUrl);
  }

  async previewVideoGeneration(
    id,
    selectedModel,
    duration,
    useFirstFrameRaw,
    resolutionRaw,
    aspectRatioRaw,
    generateAudioRaw,
  ) {
    const scene = await this.findById(id);
    if (!scene) throw new Error('scene not found');
    const prompt = assertCompositePromptLength(scene.prompt || '');
    if (!prompt) throw new Error('片段 Prompt 不能为空');
    const helper = this.ctx.service.storyboard;
    const model = String(selectedModel || '').trim() || VIDEO_MODEL.SEEDANCE_2;
    if (!helper.supportedVideoModels().has(model)) throw new Error('unsupported video model');
    const selectedDuration = helper.normalizeVideoDuration(
      model,
      duration ?? scene.generation_duration,
    );
    const useFirstFrame = helper.parseUseFirstFrame(useFirstFrameRaw);
    const aspectRatio = helper.normalizeVideoAspectRatio(model, aspectRatioRaw);
    const resolution = helper.normalizeVideoResolution(model, resolutionRaw);
    const audio = helper.parseGenerateAudio(generateAudioRaw);
    if (!helper.isSeedanceVideoModel(model) && !audio) {
      throw new Error('当前 Wan 视频模型仅支持有声输出');
    }
    const sourceImageUrl =
      useFirstFrame && scene.cover_url ? resolveMediaUrl(this.app, scene.cover_url) : '';
    const { references: baseReferences, missing } = await helper.selectVideoReferenceImages(
      scene,
      scene,
    );
    const boundReferences = [
      ...baseReferences,
      ...this.buildVideoFrameReferences(scene.video_frame_references || []),
    ];
    const references = useFirstFrame ? [] : boundReferences;
    const omittedReferences = useFirstFrame ? boundReferences : [];
    const visualInputCount = useFirstFrame ? 1 : references.length;
    const audioSummary =
      helper.isSeedanceVideoModel(model) && audio && !useFirstFrame
        ? await helper.selectVideoAudioReferences(scene, visualInputCount > 0)
        : { references: [], missing: [], totalDuration: 0, blockingReasons: [], limits: null };
    const blockingReasons = [...audioSummary.blockingReasons];
    if (helper.isSeedanceVideoModel(model) && visualInputCount > 9) {
      blockingReasons.push(
        `Seedance 2.0 首帧与参考图合计最多支持 9 张，当前为 ${visualInputCount} 张`,
      );
    }
    const finalPrompt = buildCompositeVideoPrompt(prompt, { audio, useFirstFrame });
    return {
      prompt_mode: 'composite',
      model,
      duration: selectedDuration,
      resolution,
      aspect_ratio: aspectRatio,
      audio,
      use_first_frame: useFirstFrame,
      media_input_mode: useFirstFrame
        ? 'first_frame'
        : references.length
          ? 'reference_media'
          : 'text',
      source_image_url: sourceImageUrl,
      source_image_status: !useFirstFrame
        ? 'not-required'
        : sourceImageUrl
          ? 'existing-cover'
          : 'will-generate-cover',
      will_generate_cover: useFirstFrame && !sourceImageUrl,
      reference_images: references,
      omitted_reference_images: omittedReferences,
      missing_references: missing,
      audio_reference_assets: audioSummary.references,
      missing_audio_references: audioSummary.missing,
      audio_reference_total_duration: audioSummary.totalDuration,
      audio_reference_limits: audioSummary.limits,
      blocking_reasons: blockingReasons,
      fields: {
        scene_title: scene.title,
        content: prompt,
        characters: scene.character_names || [],
      },
      video_fields: { duration: selectedDuration },
      template: 'composite-raw',
      prompt_blueprint: null,
      prompt_display_blocks: [],
      prompt_display_tokens: [{ type: 'text', text: finalPrompt }],
      final_prompt: finalPrompt,
    };
  }

  async generateVideo(id, model, duration, useFirstFrame, resolution, aspectRatio, generateAudio) {
    const preview = await this.previewVideoGeneration(
      id,
      model,
      duration,
      useFirstFrame,
      resolution,
      aspectRatio,
      generateAudio,
    );
    if (preview.blocking_reasons.length) throw new Error(preview.blocking_reasons.join('；'));
    const current = await this.findById(id);
    if (current.video_status === GENERATION_STATUS.GENERATING) {
      return { scene_id: id, scene: current };
    }
    const generation = await this.ctx.service.sceneMediaGeneration.create({
      scene_id: id,
      media_type: MEDIA_TYPE.VIDEO,
      model: preview.model,
      status: GENERATION_STATUS.GENERATING,
      source_url: preview.use_first_frame ? current.cover_url || null : null,
      meta_json: JSON.stringify({
        prompt_mode: 'composite',
        aspect_ratio: preview.aspect_ratio,
        resolution: preview.resolution,
        duration: preview.duration,
        audio: preview.audio,
        use_first_frame: preview.use_first_frame,
        reference_image_count: preview.reference_images.length,
        audio_reference_count: preview.audio_reference_assets.length,
      }),
    });
    await this.update(id, {
      generation_duration: preview.duration,
      video_status: GENERATION_STATUS.GENERATING,
      video_error: '',
    });
    void this.generateVideoAsync(id, preview, generation.id).catch((error) =>
      this.ctx.logger.error(error),
    );
    return { scene_id: id, scene: await this.findById(id) };
  }

  async generateVideoAsync(id, preview, generationId) {
    let scene = await this.findById(id);
    try {
      if (preview.use_first_frame && !scene.cover_url) {
        await this.generateCover(id, '', false);
        scene = await this.findById(id);
      }
      const imageInput = preview.use_first_frame ? resolveMediaUrl(this.app, scene.cover_url) : '';
      if (preview.use_first_frame && !imageInput) {
        throw new Error('片段首帧不可用，无法生成视频');
      }
      const result = this.ctx.service.storyboard.isSeedanceVideoModel(preview.model)
        ? await generateSeedanceVideo(
            this.app,
            preview.final_prompt,
            imageInput,
            preview.duration,
            preview.use_first_frame,
            preview.reference_images.map((item) => item.url),
            preview.audio_reference_assets.map((item) => item.url),
            preview.resolution,
            preview.aspect_ratio,
            preview.audio,
            {
              onTaskCreated: async (taskId) => {
                const currentGeneration =
                  await this.ctx.service.sceneMediaGeneration.findById(generationId);
                await this.ctx.service.sceneMediaGeneration.update(generationId, {
                  meta_json: {
                    ...parseMediaGenerationMeta(currentGeneration?.meta_json),
                    provider_task_id: taskId,
                  },
                });
              },
            },
          )
        : await generateWanxVideo(
            this.app,
            preview.final_prompt,
            imageInput,
            preview.model,
            preview.duration,
            preview.use_first_frame,
          );
      const filename = `${sanitizeFileName(`scene-${id}`)}-${Date.now()}.mp4`;
      const stored = await downloadAndStore(
        this.app,
        result.videoUrl,
        'scene-videos',
        filename,
        'video/mp4',
      );
      await this.update(id, {
        video_url: stored.publicPath,
        video_preview_url: stored.publicPath,
        video_status: GENERATION_STATUS.SUCCEEDED,
        video_error: '',
        video_duration: result.duration,
        generation_duration: result.duration,
      });
      await this.ctx.service.sceneMediaGeneration.update(generationId, {
        status: GENERATION_STATUS.SUCCEEDED,
        result_url: stored.publicPath,
        preview_url: stored.publicPath,
        source_url: preview.use_first_frame ? scene.cover_url : '',
        error_message: null,
        meta_json: {
          ...parseMediaGenerationMeta(
            (await this.ctx.service.sceneMediaGeneration.findById(generationId))?.meta_json,
          ),
          provider_task_id: result.taskId || undefined,
        },
      });
      const completedGeneration =
        await this.ctx.service.sceneMediaGeneration.findById(generationId);
      const posterUrl = await this.ctx.service.sceneVideoPoster.ensureBestEffort(
        completedGeneration,
        stored.localPath,
      );
      await this.update(id, { video_poster_url: posterUrl });
      await this.ctx.service.sceneMediaGeneration.markCurrent(id, MEDIA_TYPE.VIDEO, generationId);
    } catch (error) {
      await this.update(id, {
        video_url: '',
        video_preview_url: '',
        video_poster_url: '',
        video_status: GENERATION_STATUS.FAILED,
        video_error: error.message,
      });
      await this.ctx.service.sceneMediaGeneration.update(generationId, {
        status: GENERATION_STATUS.FAILED,
        error_message: error.message,
      });
      throw error;
    }
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
    await this.update(id, { video_status: GENERATION_STATUS.GENERATING, video_error: '' });
    try {
      const filename = `${sanitizeFileName(`scene-${id}`)}-${Date.now()}.mp4`;
      const composed = await composeVideos(
        this.app,
        inputs.map((item) => item.source),
        'scene-videos',
        filename,
      );
      const nextScene = await this.update(id, {
        video_url: composed.publicPath,
        video_preview_url: composed.previewPath,
        video_poster_url: '',
        video_status: GENERATION_STATUS.SUCCEEDED,
        video_error: '',
        video_duration: composed.duration,
      });
      const generation = await this.ctx.service.sceneMediaGeneration.create({
        scene_id: id,
        media_type: MEDIA_TYPE.VIDEO,
        model: 'legacy-ffmpeg-compose',
        status: GENERATION_STATUS.SUCCEEDED,
        result_url: composed.publicPath,
        preview_url: composed.previewPath,
        meta_json: JSON.stringify({
          source: 'legacy-storyboard-composition',
          input_count: inputs.length,
        }),
      });
      const posterUrl = await this.ctx.service.sceneVideoPoster.ensureBestEffort(generation);
      const sceneWithPoster = await this.update(id, { video_poster_url: posterUrl });
      await this.ctx.service.sceneMediaGeneration.markCurrent(id, MEDIA_TYPE.VIDEO, generation.id);
      return posterUrl ? sceneWithPoster : nextScene;
    } catch (error) {
      await this.update(id, {
        video_status: GENERATION_STATUS.FAILED,
        video_error: error.message,
      });
      throw error;
    }
  }
}

module.exports = SceneService;
