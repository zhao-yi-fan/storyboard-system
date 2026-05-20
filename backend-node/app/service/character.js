'use strict';

const Service = require('egg').Service;
const path = require('node:path');
const { resolveMediaUrl, createPreviewFromSource, avatarPreviewSpec, storyboardPreviewSpec, downloadAndStore, createPreviewFromLocalPath, storeBuffer, probeDuration, sanitizeFileName } = require('../lib/media');
const { normalizeGeneratedAssetReference, resolveUrl } = require('../lib/generated_asset');
const { generateWanxImage, generateOpenAIImage, createCharacterVoicePreview, generateCharacterVoiceReference } = require('../lib/ai_clients');

class CharacterService extends Service {
  get pool() {
    return this.app.mysqlPool;
  }

  map(row) {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      name: row.name,
      description: row.description || '',
      avatar_url: resolveUrl(this.app, row.avatar_url || '', this.app.config.storyboard.publicAppBaseUrl || ''),
      avatar_preview_url: resolveUrl(this.app, row.avatar_preview_url || '', this.app.config.storyboard.publicAppBaseUrl || ''),
      design_sheet_url: resolveUrl(this.app, row.design_sheet_url || '', this.app.config.storyboard.publicAppBaseUrl || ''),
      design_sheet_preview_url: resolveUrl(this.app, row.design_sheet_preview_url || '', this.app.config.storyboard.publicAppBaseUrl || ''),
      voice_reference_url: resolveUrl(this.app, row.voice_reference_url || '', this.app.config.storyboard.publicAppBaseUrl || ''),
      voice_reference_duration: row.voice_reference_duration == null ? 0 : Number(row.voice_reference_duration),
      voice_reference_text: row.voice_reference_text || '',
      voice_name: row.voice_name || '',
      voice_prompt: row.voice_prompt || '',
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
  }

  async ensureProjectExists(projectId) {
    const [ rows ] = await this.pool.query('SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL', [ projectId ]);
    if (!rows.length) throw new Error('project not found');
  }

  async findByProjectId(projectId) {
    await this.ensureProjectExists(projectId);
    const [ rows ] = await this.pool.query(
      `SELECT id, project_id, name, description, avatar_url, avatar_preview_url, design_sheet_url, design_sheet_preview_url,
              voice_reference_url, voice_reference_duration, voice_reference_text, voice_name, voice_prompt, created_at, updated_at
       FROM characters WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
      [ projectId ]
    );
    const items = rows.map(row => this.map(row));
    for (const item of items) {
      await this.ensureAvatarPreview(item);
      await this.ensureDesignSheetPreview(item);
    }
    return items;
  }

  async findById(id) {
    const [ rows ] = await this.pool.query(
      `SELECT id, project_id, name, description, avatar_url, avatar_preview_url, design_sheet_url, design_sheet_preview_url,
              voice_reference_url, voice_reference_duration, voice_reference_text, voice_name, voice_prompt, created_at, updated_at
       FROM characters WHERE id = ? AND deleted_at IS NULL`,
      [ id ]
    );
    if (!rows.length) {
      return null;
    }
    const item = this.map(rows[0]);
    await this.ensureAvatarPreview(item);
    await this.ensureDesignSheetPreview(item);
    return item;
  }

  async create(projectId, payload) {
    await this.ensureProjectExists(projectId);
    const name = String(payload.name || '').trim();
    if (!name) throw new Error('name is required');
    const [ result ] = await this.pool.execute(
      `INSERT INTO characters (
        project_id, name, description, avatar_url, avatar_preview_url, design_sheet_url, design_sheet_preview_url,
        voice_reference_url, voice_reference_duration, voice_reference_text, voice_name, voice_prompt
      ) VALUES (?, ?, ?, ?, '', ?, '', '', NULL, '', '', ?)`,
      [
        projectId,
        name,
        String(payload.description || '').trim(),
        normalizeGeneratedAssetReference(this.app, String(payload.avatar_url || '').trim()),
        normalizeGeneratedAssetReference(this.app, String(payload.design_sheet_url || '').trim()),
        String(payload.voice_prompt || '').trim(),
      ]
    );
    return await this.findById(result.insertId);
  }

  async update(id, payload) {
    const current = await this.findById(id);
    if (!current) throw new Error('character not found');
    const name = Object.prototype.hasOwnProperty.call(payload, 'name') ? String(payload.name || '').trim() : current.name;
    if (!name) throw new Error('name is required');
    const currentAvatarRef = normalizeGeneratedAssetReference(this.app, current.avatar_url);
    const currentDesignRef = normalizeGeneratedAssetReference(this.app, current.design_sheet_url);
    const nextAvatar = Object.prototype.hasOwnProperty.call(payload, 'avatar_url')
      ? normalizeGeneratedAssetReference(this.app, String(payload.avatar_url || '').trim())
      : currentAvatarRef;
    const nextDesign = Object.prototype.hasOwnProperty.call(payload, 'design_sheet_url')
      ? normalizeGeneratedAssetReference(this.app, String(payload.design_sheet_url || '').trim())
      : currentDesignRef;
    await this.pool.execute(
      `UPDATE characters
       SET name = ?, description = ?, avatar_url = ?, avatar_preview_url = ?, design_sheet_url = ?, design_sheet_preview_url = ?, voice_prompt = ?
       WHERE id = ?`,
      [
        name,
        Object.prototype.hasOwnProperty.call(payload, 'description') ? String(payload.description || '').trim() : current.description,
        nextAvatar,
        nextAvatar !== currentAvatarRef ? '' : normalizeGeneratedAssetReference(this.app, current.avatar_preview_url),
        nextDesign,
        nextDesign !== currentDesignRef ? '' : normalizeGeneratedAssetReference(this.app, current.design_sheet_preview_url),
        Object.prototype.hasOwnProperty.call(payload, 'voice_prompt') ? String(payload.voice_prompt || '').trim() : current.voice_prompt,
        id,
      ]
    );
    return await this.findById(id);
  }

  async softDelete(id) {
    await this.pool.execute('UPDATE characters SET deleted_at = NOW() WHERE id = ?', [ id ]);
  }

  async ensureAvatarPreview(character) {
    if (!character || !character.avatar_url || character.avatar_preview_url) {
      return;
    }
    const preview = await createPreviewFromSource(this.app, character.avatar_url, 'characters', `character-${character.id}`, avatarPreviewSpec());
    await this.pool.execute('UPDATE characters SET avatar_preview_url = ? WHERE id = ?', [ preview, character.id ]);
    character.avatar_preview_url = resolveMediaUrl(this.app, preview);
  }

  async ensureDesignSheetPreview(character) {
    if (!character || !character.design_sheet_url || character.design_sheet_preview_url) {
      return;
    }
    const preview = await createPreviewFromSource(this.app, character.design_sheet_url, 'characters', `character-design-sheet-${character.id}`, storyboardPreviewSpec());
    await this.pool.execute('UPDATE characters SET design_sheet_preview_url = ? WHERE id = ?', [ preview, character.id ]);
    character.design_sheet_preview_url = resolveMediaUrl(this.app, preview);
  }

  buildCoverPrompt(character) {
    let prompt = '为漫剧分镜系统生成一张角色封面头像。';
    if (character.name) prompt += ` 角色名称：${character.name}。`;
    if (character.description) prompt += ` 角色描述：${character.description}。`;
    prompt += ' 画面要求：单人角色肖像，主体明确，构图干净，适合在资产库中展示。风格要求：写实电影感，细节自然，避免夸张漫画化。输出要求：不要文字、水印、logo、海报排版。';
    return prompt;
  }

  buildDesignPrompt(character, mode) {
    let prompt = '为漫剧分镜系统生成角色主设定图。';
    if (character.name) prompt += ` 角色名称：${character.name}。`;
    if (character.description) prompt += ` 角色描述：${character.description}。`;
    prompt += mode === 'draft'
      ? ' 目标：快速确定角色长相、发型、服装和整体气质。'
      : ' 目标：输出最终定稿级角色设定板，作为后续镜头封面的核心参考图。';
    prompt += ' 画面要求：单张角色设定板，包含同一角色的正面全身、侧面全身、背面全身，以及半身近景头像。一致性要求：保持同一人物的脸型、五官、发型、发色、服装结构、配饰位置和身材比例完全一致。背景要求：纯净浅色背景或白底，不要剧情场景，不要复杂道具。输出要求：不要文字说明、不要水印、不要 logo、不要海报排版。';
    return prompt;
  }

  resolveDesignSelection(modelRaw, modeRaw) {
    const model = String(modelRaw || '').trim().toLowerCase();
    if (model === 'qwen-image-2.0') return { mode: 'draft', model: 'qwen-image-2.0' };
    if (model === 'gpt-image-2') return { mode: 'final', model: 'gpt-image-2' };
    if (model === 'wan2.7-image-pro') return { mode: 'final', model: 'wan2.7-image-pro' };
    return String(modeRaw || '').trim().toLowerCase() === 'draft'
      ? { mode: 'draft', model: 'qwen-image-2.0' }
      : { mode: 'final', model: 'wan2.7-image-pro' };
  }

  async previewCoverGeneration(id) {
    const character = await this.findById(id);
    if (!character) throw new Error('character not found');
    return {
      action: 'character-cover',
      model: this.app.config.storyboard.wanxModel || 'wanx2.0-t2i-turbo',
      fields: {
        角色名称: character.name,
        角色描述: character.description,
        输出: '单人角色封面头像',
      },
      final_prompt: this.buildCoverPrompt(character),
      notes: [ '用于资产库展示，重点是角色识别度和构图干净。' ],
    };
  }

  async previewDesignSheetGeneration(id, modelRaw, modeRaw) {
    const character = await this.findById(id);
    if (!character) throw new Error('character not found');
    const selection = this.resolveDesignSelection(modelRaw, modeRaw);
    return {
      action: 'character-design-sheet',
      model: selection.model,
      fields: {
        角色名称: character.name,
        角色描述: character.description,
        生成模型: selection.model,
        生成档位: selection.mode,
        输出: '角色主设定图',
      },
      final_prompt: this.buildDesignPrompt(character, selection.mode),
      notes: [ '主设定图会作为后续镜头封面生成的人物核心参考图。' ],
    };
  }

  async previewVoiceReferenceGeneration(id, voicePrompt, previewText) {
    const character = await this.findById(id);
    if (!character) throw new Error('character not found');
    const preview = await createCharacterVoicePreview(this.app, character, voicePrompt, previewText);
    return {
      action: 'character-voice-reference',
      model: preview.designModel,
      fields: {
        角色名称: character.name,
        角色描述: character.description,
        目标语音模型: preview.targetModel,
        音色名称: preview.preferredVoiceName,
        参考文本: preview.previewText,
      },
      final_prompt: preview.voicePrompt,
      notes: [ '这段主语音参考会绑定到当前角色，后续对白和视频音频优先参考该声音。' ],
    };
  }

  async generateCover(id) {
    const character = await this.findById(id);
    if (!character) throw new Error('character not found');
    const imageUrl = await generateWanxImage(this.app, this.buildCoverPrompt(character), this.app.config.storyboard.wanxModel || 'qwen-image-2.0');
    const filename = `${sanitizeFileName(`character-avatar-${id}`)}-${Date.now()}.png`;
    const stored = await downloadAndStore(this.app, imageUrl, 'characters', filename, 'image/png');
    const previewFilename = `${path.basename(filename, path.extname(filename))}.thumb.webp`;
    const previewPath = await createPreviewFromLocalPath(this.app, stored.localPath, 'characters', previewFilename, avatarPreviewSpec());
    await this.pool.execute('UPDATE characters SET avatar_url = ?, avatar_preview_url = ? WHERE id = ?', [ stored.publicPath, previewPath, id ]);
    return await this.findById(id);
  }

  async generateDesignSheet(id, modelRaw, modeRaw) {
    const character = await this.findById(id);
    if (!character) throw new Error('character not found');
    const selection = this.resolveDesignSelection(modelRaw, modeRaw);
    const prompt = this.buildDesignPrompt(character, selection.mode);
    let stored;
    if (selection.model === 'gpt-image-2') {
      const imageBytes = await generateOpenAIImage(this.app, prompt, selection.model);
      const filename = `${sanitizeFileName(`character-design-sheet-${id}`)}-${Date.now()}.png`;
      stored = await storeBuffer(this.app, imageBytes, 'characters', filename, 'image/png');
    } else {
      const imageUrl = await generateWanxImage(this.app, prompt, selection.model);
      const filename = `${sanitizeFileName(`character-design-sheet-${id}`)}-${Date.now()}.png`;
      stored = await downloadAndStore(this.app, imageUrl, 'characters', filename, 'image/png');
    }
    const previewFilename = `${path.basename(stored.publicPath, path.extname(stored.publicPath))}.thumb.webp`.replace(/^.*\//, '');
    const previewPath = await createPreviewFromLocalPath(this.app, stored.localPath, 'characters', previewFilename, storyboardPreviewSpec());
    await this.pool.execute('UPDATE characters SET design_sheet_url = ?, design_sheet_preview_url = ? WHERE id = ?', [ stored.publicPath, previewPath, id ]);
    return await this.findById(id);
  }

  async generateVoiceReference(id, voicePrompt, previewText) {
    const character = await this.findById(id);
    if (!character) throw new Error('character not found');
    const result = await generateCharacterVoiceReference(this.app, character, voicePrompt, previewText);
    const filename = `${sanitizeFileName(`character-voice-reference-${id}`)}-${Date.now()}.${result.extension}`;
    const stored = await storeBuffer(this.app, result.audioBuffer, 'characters', filename, 'audio/wav');
    let duration = 0;
    try {
      duration = await probeDuration(stored.localPath);
    } catch {}
    await this.pool.execute(
      `UPDATE characters
       SET voice_reference_url = ?, voice_reference_duration = ?, voice_reference_text = ?, voice_name = ?, voice_prompt = ?
       WHERE id = ?`,
      [ stored.publicPath, duration, result.voiceReferenceText, result.voiceName, result.voicePrompt, id ]
    );
    return await this.findById(id);
  }
}

module.exports = CharacterService;
