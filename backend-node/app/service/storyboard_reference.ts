'use strict';

const Service = require('egg').Service;

const { materializeSourceToLocalFile, probeDuration } = require('../lib/media');
const { resolveSignedUrl } = require('../lib/generated_asset');
import type {
  AssetEntity,
  AudioReferenceItem,
  CharacterEntity,
  ImageReferenceItem,
  ReferenceSubject,
  SceneEntity,
  StoryboardEntity,
} from '../lib/entity';
const {
  ENTITY_TYPE,
  REFERENCE_TYPE,
  VIDEO_MODEL,
  VIDEO_ASPECT_RATIO,
  VIDEO_RESOLUTION,
} = require('../lib/domain_constants');

class StoryboardReferenceService extends Service {
  static SEEDANCE_VIDEO_MODEL = VIDEO_MODEL.SEEDANCE_2;
  static VIDEO_ASPECT_RATIO_9_16 = VIDEO_ASPECT_RATIO.PORTRAIT;
  static SEEDANCE_MAX_REFERENCE_AUDIO_COUNT = 3;
  static SEEDANCE_MIN_REFERENCE_AUDIO_SECONDS = 2;
  static SEEDANCE_MAX_REFERENCE_AUDIO_TOTAL_SECONDS = 15;
  static SEEDANCE_MAX_VISUAL_INPUT_COUNT = 9;
  static SEEDANCE_RESOLUTIONS = new Set(Object.values(VIDEO_RESOLUTION));

  get pool() {
    return this.app.mysqlPool;
  }

  supportedCoverModels() {
    return new Set(
      ['', 'auto', 'seedream-4.5', this.app.config.storyboard.seedreamImageModel].filter(Boolean),
    );
  }

  supportedVideoModels() {
    return new Set([VIDEO_MODEL.WAN_2_7_I2V, StoryboardReferenceService.SEEDANCE_VIDEO_MODEL]);
  }

  isSeedanceVideoModel(model: string) {
    return String(model || '').trim() === StoryboardReferenceService.SEEDANCE_VIDEO_MODEL;
  }

  resolveStoryboardStylePreset(scene: SceneEntity, storyboard: StoryboardEntity) {
    return String(storyboard.style_preset || scene.style_preset || '').trim();
  }

  resolveStoryboardStyleNotes(scene: SceneEntity, storyboard: StoryboardEntity) {
    return String(storyboard.style_notes || scene.style_notes || '').trim();
  }

  parseBooleanFlag(value: unknown, defaultValue: boolean = true) {
    if (typeof value === 'boolean') {
      return value;
    }
    const normalized = String(value === null || value === undefined ? defaultValue : value)
      .trim()
      .toLowerCase();
    return normalized !== 'false' && normalized !== '0' && normalized !== 'off';
  }

  parseUseFirstFrame(value: unknown) {
    return this.parseBooleanFlag(value, true);
  }

  parseGenerateAudio(value: unknown) {
    return this.parseBooleanFlag(value, true);
  }

  normalizeVideoAspectRatio(_model: string, value: string) {
    const aspectRatio = String(value || StoryboardReferenceService.VIDEO_ASPECT_RATIO_9_16).trim();
    if (aspectRatio !== StoryboardReferenceService.VIDEO_ASPECT_RATIO_9_16) {
      throw new Error('当前仅支持 9:16 竖屏输出');
    }
    return aspectRatio;
  }

  normalizeVideoResolution(model: string, value: string) {
    const isSeedance = this.isSeedanceVideoModel(model);
    const resolution = String(value || (isSeedance ? VIDEO_RESOLUTION.SD : VIDEO_RESOLUTION.HD))
      .trim()
      .toLowerCase();
    if (isSeedance && !StoryboardReferenceService.SEEDANCE_RESOLUTIONS.has(resolution)) {
      throw new Error('Seedance 2.0 分辨率仅支持 480p、720p 或 1080p');
    }
    if (!isSeedance && resolution !== VIDEO_RESOLUTION.HD) {
      throw new Error('当前 Wan 视频模型仅支持 720p 输出');
    }
    return resolution;
  }

  normalizeVideoDuration(model: string, value: unknown) {
    const duration = Number(value === null || value === undefined || value === '' ? 5 : value);
    if (!Number.isInteger(duration)) {
      throw new Error('视频时长必须为整数秒');
    }
    if (this.isSeedanceVideoModel(model)) {
      if (duration < 4 || duration > 15) {
        throw new Error('Seedance 2.0 视频时长仅支持 4-15 秒');
      }
      return duration;
    }
    if (duration !== 5) {
      throw new Error('当前 Wan 视频模型仅支持 5 秒输出');
    }
    return duration;
  }

  getAssetFileExtension(asset: AssetEntity) {
    const source = String(asset?.file_url || '').split(/[?#]/)[0];
    return source.includes('.') ? source.slice(source.lastIndexOf('.') + 1).toLowerCase() : '';
  }

  isAudioAsset(asset: AssetEntity) {
    const type = String(asset?.type || '').trim();
    const extension = this.getAssetFileExtension(asset);
    return (
      /(audio|voice|sound|music|sfx|配音|语音|音频|音乐|音效)/i.test(type) ||
      ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'].includes(extension)
    );
  }

  getAssetReferenceType(asset: AssetEntity) {
    const type = String(asset?.type || '').trim();
    if (/(scene|background|location|场景|背景|地点)/i.test(type)) {
      return REFERENCE_TYPE.SCENE;
    }
    if (this.isAudioAsset(asset)) return REFERENCE_TYPE.AUDIO;
    if (/(prop|道具)/i.test(type)) return REFERENCE_TYPE.PROP;
    if (/(costume|服装)/i.test(type)) return REFERENCE_TYPE.COSTUME;
    return REFERENCE_TYPE.ASSET;
  }

  async selectAssetReferenceImages(storyboard: ReferenceSubject, _scene?: SceneEntity) {
    const references: ImageReferenceItem[] = [];
    const missing: string[] = [];
    for (const asset of Array.isArray(storyboard.assets) ? storyboard.assets : []) {
      if (this.isAudioAsset(asset)) continue;
      const url = resolveSignedUrl(
        this.app,
        asset.cover_url || asset.file_url,
        this.app.config.storyboard.publicAppBaseUrl || '',
      );
      if (url) {
        references.push({
          asset_id: Number(asset.id),
          type: this.getAssetReferenceType(asset),
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

  async selectReferenceImages(storyboard: ReferenceSubject, scene: SceneEntity) {
    const { references, missing } = await this.selectAssetReferenceImages(storyboard, scene);
    for (const character of storyboard.characters.slice(0, 2)) {
      const url = resolveSignedUrl(
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
        type: ENTITY_TYPE.CHARACTER,
        name: character.name,
        url,
        source: 'character.design_sheet_url',
      });
    }
    return { references, missing };
  }

  selectVideoCharacterReferenceImages(storyboard: ReferenceSubject) {
    const references: ImageReferenceItem[] = [];
    const missing: string[] = [];
    for (const character of storyboard.characters.slice(0, 2)) {
      const url = resolveSignedUrl(
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
        type: ENTITY_TYPE.CHARACTER,
        name: character.name,
        url,
        source: 'character.design_sheet_url',
      });
    }
    return { references, missing };
  }

  async selectVideoReferenceImages(storyboard: ReferenceSubject, scene: SceneEntity) {
    const { references: sceneReferences, missing: sceneMissing } =
      await this.selectAssetReferenceImages(storyboard, scene);
    const { references: characterReferences, missing: characterMissing } =
      this.selectVideoCharacterReferenceImages(storyboard);
    return {
      references: [...sceneReferences, ...characterReferences],
      missing: [...sceneMissing, ...characterMissing],
    };
  }

  async resolveVoiceReferenceDuration(character: CharacterEntity, url: string) {
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
        (error as Error).message,
      );
      return 0;
    } finally {
      if (materialized) {
        await materialized.cleanup();
      }
    }
  }

  getAssetMetaDuration(asset: AssetEntity) {
    const meta = asset?.meta;
    if (!meta) return 0;
    try {
      const parsed = JSON.parse(String(meta));
      return Number(parsed.duration || parsed.duration_seconds || 0) || 0;
    } catch {
      const match = String(meta).match(/(?:duration|时长)\s*[=:：]\s*(\d+(?:\.\d+)?)/i);
      return Number(match?.[1] || 0) || 0;
    }
  }

  async resolveAssetAudioDuration(asset: AssetEntity, url: string) {
    const metaDuration = this.getAssetMetaDuration(asset);
    if (metaDuration > 0) return metaDuration;
    let materialized;
    try {
      materialized = await materializeSourceToLocalFile(this.app, url, '.audio');
      return await probeDuration(materialized.localPath);
    } catch (error) {
      this.ctx.logger.warn(
        '[seedance] failed to probe audio asset duration asset=%s: %s',
        asset.id,
        (error as Error).message,
      );
      return 0;
    } finally {
      if (materialized) await materialized.cleanup();
    }
  }

  async selectVideoAudioReferences(storyboard: ReferenceSubject, hasVisualInput: boolean) {
    const references: AudioReferenceItem[] = [];
    const missing: string[] = [];
    const blockingReasons: string[] = [];
    for (const character of Array.isArray(storyboard.characters) ? storyboard.characters : []) {
      const url = resolveSignedUrl(
        this.app,
        character.voice_reference_url,
        this.app.config.storyboard.publicAppBaseUrl || '',
      );
      if (!url) {
        missing.push(character.name);
        continue;
      }
      references.push({
        reference_id: `character:${character.id}`,
        character_id: Number(character.id),
        type: ENTITY_TYPE.CHARACTER,
        name: character.name,
        url,
        source: 'character.voice_reference_url',
        duration: await this.resolveVoiceReferenceDuration(character, url),
        voice_name: String(character.voice_name || '').trim(),
      });
    }
    for (const asset of Array.isArray(storyboard.assets) ? storyboard.assets : []) {
      if (!this.isAudioAsset(asset)) continue;
      const url = resolveSignedUrl(
        this.app,
        asset.file_url,
        this.app.config.storyboard.publicAppBaseUrl || '',
      );
      if (!url) {
        missing.push(asset.name);
        continue;
      }
      references.push({
        reference_id: `asset:${asset.id}`,
        asset_id: Number(asset.id),
        type: ENTITY_TYPE.ASSET,
        name: String(asset.name || '').trim(),
        url,
        source: 'asset.file_url',
        duration: await this.resolveAssetAudioDuration(asset, url),
        voice_name: String(asset.type || '音频资产').trim(),
      });
    }
    if (missing.length) {
      blockingReasons.push(`以下角色缺少主语音参考：${missing.join('、')}`);
    }
    if (references.length > StoryboardReferenceService.SEEDANCE_MAX_REFERENCE_AUDIO_COUNT) {
      blockingReasons.push(
        `Seedance 2.0 最多支持 ${StoryboardReferenceService.SEEDANCE_MAX_REFERENCE_AUDIO_COUNT} 段参考音频，当前为 ${references.length} 段`,
      );
    }
    const invalidDurationReferences = references.filter(
      (item) =>
        item.duration < StoryboardReferenceService.SEEDANCE_MIN_REFERENCE_AUDIO_SECONDS ||
        item.duration > StoryboardReferenceService.SEEDANCE_MAX_REFERENCE_AUDIO_SECONDS,
    );
    if (invalidDurationReferences.length) {
      blockingReasons.push(
        `以下角色主语音时长不在 2-15 秒范围内：${invalidDurationReferences.map((item) => `${item.name}${item.duration ? `(${item.duration.toFixed(1)}s)` : '(未知时长)'}`).join('、')}`,
      );
    }
    const totalDuration = references.reduce((sum: number, item) => sum + item.duration, 0);
    if (totalDuration > StoryboardReferenceService.SEEDANCE_MAX_REFERENCE_AUDIO_TOTAL_SECONDS) {
      blockingReasons.push(
        `Seedance 2.0 参考音频总时长不能超过 15 秒，当前为 ${totalDuration.toFixed(1)} 秒`,
      );
    }
    if (references.length && !hasVisualInput) {
      blockingReasons.push('Seedance 2.0 传入角色参考音频时必须同时传入首帧或参考图');
    }
    return {
      references,
      missing,
      totalDuration,
      blockingReasons,
      limits: {
        max_count: StoryboardReferenceService.SEEDANCE_MAX_REFERENCE_AUDIO_COUNT,
        min_duration: StoryboardReferenceService.SEEDANCE_MIN_REFERENCE_AUDIO_SECONDS,
        max_duration: StoryboardReferenceService.SEEDANCE_MAX_REFERENCE_AUDIO_SECONDS,
        max_total_duration: StoryboardReferenceService.SEEDANCE_MAX_REFERENCE_AUDIO_TOTAL_SECONDS,
        formats: ['wav', 'mp3'],
      },
    };
  }
}

module.exports = StoryboardReferenceService;
