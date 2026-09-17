'use strict';

const Service = require('egg').Service;
const {
  sanitizeFileName,
  downloadAndStore,
  resolveMediaUrl,
} = require('../lib/media');
const {
  generateWanxVideo,
  generateSeedanceVideo,
} = require('../lib/ai_clients');
const { parseMediaGenerationMeta } = require('../lib/media_generation_meta');
const {
  buildStoryboardVideoPrompt,
  buildPromptDisplayBlocks,
  buildPromptDisplayTokens,
} = require('../lib/prompt_library');
const {
  buildCompositeVideoPrompt,
  isCompositeStoryboardPrompt,
} = require('../lib/composite_prompt');
const {
  GENERATION_STATUS,
  MEDIA_TYPE,
  VIDEO_MODEL,
  VIDEO_ASPECT_RATIO,
  VIDEO_RESOLUTION,
} = require('../lib/domain_constants');

class StoryboardVideoService extends Service {
  static SEEDANCE_VIDEO_MODEL = VIDEO_MODEL.SEEDANCE_2;
  static VIDEO_ASPECT_RATIO_9_16 = VIDEO_ASPECT_RATIO.PORTRAIT;
  static SEEDANCE_MAX_VISUAL_INPUT_COUNT = 9;
  static SEEDANCE_RESOLUTIONS = new Set(Object.values(VIDEO_RESOLUTION));

  get pool() {
    return this.app.mysqlPool;
  }

  supportedVideoModels() {
    return new Set([VIDEO_MODEL.WAN_2_7_I2V, StoryboardVideoService.SEEDANCE_VIDEO_MODEL]);
  }

  isSeedanceVideoModel(model: string) {
    return String(model || '').trim() === StoryboardVideoService.SEEDANCE_VIDEO_MODEL;
  }

  resolveStoryboardStylePreset(scene: any, storyboard: any) {
    return String(storyboard.style_preset || scene.style_preset || '').trim();
  }

  resolveStoryboardStyleNotes(scene: any, storyboard: any) {
    return String(storyboard.style_notes || scene.style_notes || '').trim();
  }

  parseBooleanFlag(value: any, defaultValue: boolean = true) {
    if (typeof value === 'boolean') {
      return value;
    }
    const normalized = String(value === null || value === undefined ? defaultValue : value)
      .trim()
      .toLowerCase();
    return normalized !== 'false' && normalized !== '0' && normalized !== 'off';
  }

  parseUseFirstFrame(value: any) {
    return this.parseBooleanFlag(value, true);
  }

  parseGenerateAudio(value: any) {
    return this.parseBooleanFlag(value, true);
  }

  normalizeVideoAspectRatio(_model: string, value: string) {
    const aspectRatio = String(value || StoryboardVideoService.VIDEO_ASPECT_RATIO_9_16).trim();
    if (aspectRatio !== StoryboardVideoService.VIDEO_ASPECT_RATIO_9_16) {
      throw new Error('当前仅支持 9:16 竖屏输出');
    }
    return aspectRatio;
  }

  normalizeVideoResolution(model: string, value: string) {
    const isSeedance = this.isSeedanceVideoModel(model);
    const resolution = String(
      value || (isSeedance ? VIDEO_RESOLUTION.SD : VIDEO_RESOLUTION.HD),
    )
      .trim()
      .toLowerCase();
    if (isSeedance && !StoryboardVideoService.SEEDANCE_RESOLUTIONS.has(resolution)) {
      throw new Error('Seedance 2.0 分辨率仅支持 480p、720p 或 1080p');
    }
    if (!isSeedance && resolution !== VIDEO_RESOLUTION.HD) {
      throw new Error('当前 Wan 视频模型仅支持 720p 输出');
    }
    return resolution;
  }

  normalizeVideoDuration(model: string, value: any) {
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

  async previewVideoGeneration(
    id: number,
    selectedModel: string,
    duration: any,
    useFirstFrameRaw: any,
    resolutionRaw: string,
    generateAudioRaw: any,
  ) {
    const storyboard = await this.ctx.service.storyboard.findById(id);
    if (!storyboard) {
      throw new Error('storyboard not found');
    }
    const scene = await this.ctx.service.scene.findById(storyboard.scene_id);
    if (!scene) {
      throw new Error('scene not found');
    }
    const composite = isCompositeStoryboardPrompt(storyboard.content);
    const model =
      String(selectedModel || '').trim() ||
      (composite
        ? StoryboardVideoService.SEEDANCE_VIDEO_MODEL
        : this.app.config.storyboard.wanxVideoModel || VIDEO_MODEL.WAN_2_7_I2V);
    if (!this.supportedVideoModels().has(model)) {
      throw new Error('unsupported video model');
    }
    const selectedDuration = this.normalizeVideoDuration(model, duration);
    const useFirstFrame = this.parseUseFirstFrame(useFirstFrameRaw);
    const isSeedance = this.isSeedanceVideoModel(model);
    const resolution = this.normalizeVideoResolution(model, resolutionRaw);
    const generateAudio = this.parseGenerateAudio(generateAudioRaw);
    if (!isSeedance && !generateAudio) {
      throw new Error('当前 Wan 视频模型仅支持有声输出');
    }
    const sourceImageUrl =
      useFirstFrame && storyboard.thumbnail_url
        ? resolveMediaUrl(this.app, storyboard.thumbnail_url)
        : '';
    const { references: boundReferenceImages, missing: missingReferences } =
      await this.ctx.service.storyboardReference.selectVideoReferenceImages(storyboard, scene);
    const referenceImages = useFirstFrame ? [] : boundReferenceImages;
    const omittedReferenceImages = useFirstFrame ? boundReferenceImages : [];
    const visualInputCount = useFirstFrame ? 1 : referenceImages.length;
    const audioReferenceSummary =
      isSeedance && generateAudio && !useFirstFrame
        ? await this.ctx.service.storyboardReference.selectVideoAudioReferences(storyboard, visualInputCount > 0)
        : { references: [], missing: [], totalDuration: 0, blockingReasons: [], limits: null };
    const blockingReasons = [...audioReferenceSummary.blockingReasons];
    if (isSeedance && visualInputCount > StoryboardVideoService.SEEDANCE_MAX_VISUAL_INPUT_COUNT) {
      blockingReasons.push(
        `Seedance 2.0 首帧与参考图合计最多支持 ${StoryboardVideoService.SEEDANCE_MAX_VISUAL_INPUT_COUNT} 张，当前为 ${visualInputCount} 张`,
      );
    }
    const videoPrompt = composite
      ? {
          template: 'composite-raw',
          blueprint: null,
          prompt: buildCompositeVideoPrompt(storyboard.content, {
            audio: generateAudio,
            useFirstFrame,
          }),
        }
      : buildStoryboardVideoPrompt(
          {
            ...storyboard,
            style_preset: this.resolveStoryboardStylePreset(scene, storyboard),
            style_notes: this.resolveStoryboardStyleNotes(scene, storyboard),
          },
          scene,
          selectedDuration,
          { audio: generateAudio, useFirstFrame },
        );
    return {
      prompt_mode: composite ? 'composite' : 'legacy',
      model,
      duration: selectedDuration,
      resolution,
      audio: generateAudio,
      use_first_frame: useFirstFrame,
      media_input_mode: useFirstFrame
        ? 'first_frame'
        : referenceImages.length
          ? 'reference_media'
          : 'text',
      source_image_url: sourceImageUrl,
      source_image_status: !useFirstFrame
        ? 'not-required'
        : sourceImageUrl
          ? 'existing-cover'
          : 'will-generate-cover',
      will_generate_cover: useFirstFrame && !sourceImageUrl,
      reference_images: referenceImages.map((item: any) => ({
        type: item.type,
        name: item.name,
        url: item.url,
        source: item.source,
      })),
      omitted_reference_images: omittedReferenceImages.map((item: any) => ({
        type: item.type,
        name: item.name,
        url: item.url,
        source: item.source,
      })),
      missing_references: missingReferences,
      audio_reference_assets: audioReferenceSummary.references.map((item: any) => ({
        reference_id: item.reference_id,
        character_id: item.character_id,
        asset_id: item.asset_id,
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
      blocking_reasons: blockingReasons,
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
      prompt_display_blocks: videoPrompt.blueprint
        ? buildPromptDisplayBlocks(videoPrompt.blueprint)
        : [],
      prompt_display_tokens: videoPrompt.blueprint
        ? buildPromptDisplayTokens({
            finalPrompt: videoPrompt.prompt,
            sceneTitle: scene.title,
            characters: storyboard.character_names,
            stylePreset: this.resolveStoryboardStylePreset(scene, storyboard),
            cameraDirection: storyboard.camera_direction,
            cameraMotion: storyboard.camera_motion,
            audio: generateAudio,
            useFirstFrame,
            hasSourceImage: !!sourceImageUrl,
            timeline: videoPrompt.blueprint.timeline,
          })
        : [{ type: 'text', text: videoPrompt.prompt }],
      final_prompt: videoPrompt.prompt,
    };
  }

  async generateVideo(
    id: number,
    selectedModel: string,
    duration: any,
    useFirstFrameRaw: any,
    resolutionRaw: string,
    generateAudioRaw: any,
  ) {
    const preview = await this.previewVideoGeneration(
      id,
      selectedModel,
      duration,
      useFirstFrameRaw,
      resolutionRaw,
      generateAudioRaw,
    );
    if (Array.isArray(preview.blocking_reasons) && preview.blocking_reasons.length) {
      throw new Error(preview.blocking_reasons.join('；'));
    }
    const current = await this.ctx.service.storyboard.findById(id);
    if (current.video_status === GENERATION_STATUS.GENERATING) {
      return {
        storyboard_id: current.id,
        video_url: current.video_url,
        video_preview_url: current.video_preview_url,
        storyboard: current,
      };
    }
    const generation = await this.ctx.service.mediaGeneration.create({
      storyboard_id: id,
      media_type: MEDIA_TYPE.VIDEO,
      model: preview.model,
      status: GENERATION_STATUS.GENERATING,
      source_url: preview.use_first_frame ? current.thumbnail_url || null : null,
      meta_json: JSON.stringify({
        prompt_mode: preview.prompt_mode,
        resolution: preview.resolution,
        duration: preview.duration,
        audio: preview.audio,
        use_first_frame: preview.use_first_frame,
        first_frame_status: preview.source_image_status,
        reference_image_count: preview.reference_images?.length || 0,
        audio_reference_count: preview.audio_reference_assets?.length || 0,
        audio_reference_characters: (preview.audio_reference_assets || []).map((item: any) => item.name),
        audio_reference_total_duration: preview.audio_reference_total_duration || 0,
      }),
    });

    await this.ctx.service.storyboard.update(id, {
      video_status: GENERATION_STATUS.GENERATING,
      video_error: '',
    });

    void this.generateVideoAsync(id, preview, generation.id).catch((err: any) =>
      this.ctx.logger.error(err),
    );
    const refreshed = await this.ctx.service.storyboard.findById(id);
    return {
      storyboard_id: refreshed.id,
      video_url: refreshed.video_url,
      video_preview_url: refreshed.video_preview_url,
      storyboard: refreshed,
    };
  }

  async generateVideoAsync(id: number, preview: any, generationId: number) {
    const generation = await this.ctx.service.mediaGeneration.findById(generationId);
    let storyboard = await this.ctx.service.storyboard.findById(id);
    try {
      if (preview.use_first_frame && !storyboard.thumbnail_url) {
        await this.ctx.service.storyboardCover.generateCover(id, '', false);
        storyboard = await this.ctx.service.storyboard.findById(id);
      }
      const imageInput = preview.use_first_frame
        ? resolveMediaUrl(this.app, storyboard.thumbnail_url)
        : '';
      if (preview.use_first_frame && !imageInput) {
        throw new Error('镜头封面图不可用，无法生成视频');
      }
      const prompt = preview.final_prompt;
      const result = this.isSeedanceVideoModel(preview.model)
        ? await generateSeedanceVideo(
            this.app,
            prompt,
            imageInput,
            preview.duration,
            preview.use_first_frame,
            (preview.reference_images || []).map((item: any) => item.url),
            (preview.audio_reference_assets || []).map((item: any) => item.url),
            preview.resolution,
            preview.audio,
            {
              onTaskCreated: async (taskId: any) => {
                const currentGeneration = await this.ctx.service.mediaGeneration.findById(
                  generationId,
                );
                await this.ctx.service.mediaGeneration.update(generationId, {
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
      await this.ctx.service.storyboard.update(id, {
        video_url: stored.publicPath,
        video_preview_url: stored.publicPath,
        video_status: GENERATION_STATUS.SUCCEEDED,
        video_error: '',
        video_duration: result.duration,
        duration: result.duration,
      });
      await this.ctx.service.mediaGeneration.update(generation.id, {
        status: GENERATION_STATUS.SUCCEEDED,
        result_url: stored.publicPath,
        preview_url: stored.publicPath,
        source_url: preview.use_first_frame ? storyboard.thumbnail_url : '',
        error_message: null,
        meta_json: JSON.stringify({
          prompt_mode: preview.prompt_mode,
          resolution: preview.resolution,
          duration: result.duration,
          audio: preview.audio,
          use_first_frame: preview.use_first_frame,
          first_frame_status: preview.source_image_status,
          reference_image_count: preview.reference_images?.length || 0,
          audio_reference_count: preview.audio_reference_assets?.length || 0,
          audio_reference_characters: (preview.audio_reference_assets || []).map(
            (item: any) => item.name,
          ),
          audio_reference_total_duration: preview.audio_reference_total_duration || 0,
          provider_task_id: result.taskId || undefined,
        }),
      });
      await this.ctx.service.mediaGeneration.markCurrent(id, MEDIA_TYPE.VIDEO, generation.id);
    } catch (error) {
      await this.ctx.service.storyboard.update(id, {
        video_url: '',
        video_preview_url: '',
        video_status: GENERATION_STATUS.FAILED,
        video_error: (error as Error).message,
      });
      await this.ctx.service.mediaGeneration.update(generation.id, {
        status: GENERATION_STATUS.FAILED,
        error_message: (error as Error).message,
      });
    }
  }

  async listSceneVideoInputs(sceneId: number) {
    const items = await this.ctx.service.storyboard.findBySceneId(sceneId);
    return items
      .filter((item: any) => item.video_status === GENERATION_STATUS.SUCCEEDED && item.video_url)
      .sort((a: any, b: any) => a.sort_order - b.sort_order || a.shot_number - b.shot_number)
      .map((item: any) => ({
        source: item.video_url,
        duration: item.video_duration || item.duration || 5,
      }));
  }
}

module.exports = StoryboardVideoService;
