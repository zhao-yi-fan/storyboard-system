'use strict';

const Service = require('egg').Service;

const { sanitizeFileName, downloadAndStore, resolveMediaUrl } = require('../lib/media');
const {
  generateWanxVideo,
  generateSeedanceVideo,
  isVideoTimeoutError,
  pollSeedanceVideoTask,
  pollWanxVideoTask,
} = require('../lib/ai_clients');
const { parseMediaGenerationMeta } = require('../lib/media_generation_meta');
import type {
  AudioReferenceSummary,
  ImageReferenceItem,
  StoryboardMediaGenerationEntity,
  StoryboardVideoPreview,
} from '../lib/entity';
const {
  buildStoryboardVideoPrompt,
  buildPromptDisplayBlocks,
  buildPromptDisplayTokens,
} = require('../lib/prompt_library');
const {
  buildCompositeVideoPrompt,
  isCompositeStoryboardPrompt,
} = require('../lib/composite_prompt');
const { GENERATION_STATUS, MEDIA_TYPE, VIDEO_MODEL } = require('../lib/domain_constants');

const { StoryboardReferenceService } = require('./storyboard_reference');
class StoryboardVideoService extends Service {
  async previewVideoGeneration(
    id: number,
    selectedModel: string,
    duration: unknown,
    useFirstFrameRaw: unknown,
    resolutionRaw: string,
    generateAudioRaw: unknown,
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
        ? StoryboardReferenceService.SEEDANCE_VIDEO_MODEL
        : this.app.config.storyboard.wanxVideoModel || VIDEO_MODEL.WAN_2_7_I2V);
    if (!this.supportedVideoModels().has(model)) {
      throw new Error('unsupported video model');
    }
    const selectedDuration = this.ctx.service.storyboardReference.normalizeVideoDuration(
      model,
      duration,
    );
    const useFirstFrame = this.ctx.service.storyboardReference.parseUseFirstFrame(useFirstFrameRaw);
    const isSeedance = this.ctx.service.storyboardReference.isSeedanceVideoModel(model);
    const resolution = this.ctx.service.storyboardReference.normalizeVideoResolution(
      model,
      resolutionRaw,
    );
    const generateAudio = this.ctx.service.storyboardReference.parseGenerateAudio(generateAudioRaw);
    if (!isSeedance && !generateAudio) {
      throw new Error('当前 Wan 视频模型仅支持有声输出');
    }
    const sourceImageUrl =
      useFirstFrame && storyboard.thumbnail_url
        ? resolveMediaUrl(this.app, storyboard.thumbnail_url)
        : '';
    const {
      references: boundReferenceImages,
      missing: missingReferences,
    }: {
      references: ImageReferenceItem[];
      missing: string[];
    } = await this.ctx.service.storyboardReference.selectVideoReferenceImages(storyboard, scene);
    const referenceImages = useFirstFrame ? [] : boundReferenceImages;
    const omittedReferenceImages = useFirstFrame ? boundReferenceImages : [];
    const visualInputCount = useFirstFrame ? 1 : referenceImages.length;
    const audioReferenceSummary: AudioReferenceSummary =
      isSeedance && generateAudio && !useFirstFrame
        ? await this.ctx.service.storyboardReference.selectVideoAudioReferences(
            storyboard,
            visualInputCount > 0,
          )
        : { references: [], missing: [], totalDuration: 0, blockingReasons: [], limits: null };
    const blockingReasons = [...audioReferenceSummary.blockingReasons];
    if (
      isSeedance &&
      visualInputCount > StoryboardReferenceService.SEEDANCE_MAX_VISUAL_INPUT_COUNT
    ) {
      blockingReasons.push(
        `Seedance 2.0 首帧与参考图合计最多支持 ${StoryboardReferenceService.SEEDANCE_MAX_VISUAL_INPUT_COUNT} 张，当前为 ${visualInputCount} 张`,
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
            style_preset: this.ctx.service.storyboardReference.resolveStoryboardStylePreset(
              scene,
              storyboard,
            ),
            style_notes: this.ctx.service.storyboardReference.resolveStoryboardStyleNotes(
              scene,
              storyboard,
            ),
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
      reference_images: referenceImages.map((item) => ({
        type: item.type,
        name: item.name,
        url: item.url,
        source: item.source,
      })),
      omitted_reference_images: omittedReferenceImages.map((item) => ({
        type: item.type,
        name: item.name,
        url: item.url,
        source: item.source,
      })),
      missing_references: missingReferences,
      audio_reference_assets: audioReferenceSummary.references.map((item) => ({
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
        style_preset: this.ctx.service.storyboardReference.resolveStoryboardStylePreset(
          scene,
          storyboard,
        ),
        style_notes: this.ctx.service.storyboardReference.resolveStoryboardStyleNotes(
          scene,
          storyboard,
        ),
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
            stylePreset: this.ctx.service.storyboardReference.resolveStoryboardStylePreset(
              scene,
              storyboard,
            ),
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
    duration: unknown,
    useFirstFrameRaw: unknown,
    resolutionRaw: string,
    generateAudioRaw: unknown,
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
    if (!current) throw new Error('storyboard not found');
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
        audio_reference_characters: (preview.audio_reference_assets || []).map((item) => item.name),
        audio_reference_total_duration: preview.audio_reference_total_duration || 0,
      }),
    });

    await this.ctx.service.storyboard.update(id, {
      video_status: GENERATION_STATUS.GENERATING,
      video_error: '',
    });

    void this.generateVideoAsync(id, preview, generation.id).catch((err: unknown) =>
      this.ctx.logger.error(err),
    );
    const refreshed = await this.ctx.service.storyboard.findById(id);
    if (!refreshed) throw new Error('storyboard not found');
    return {
      storyboard_id: refreshed.id,
      video_url: refreshed.video_url,
      video_preview_url: refreshed.video_preview_url,
      storyboard: refreshed,
    };
  }

  async generateVideoAsync(id: number, preview: StoryboardVideoPreview, generationId: number) {
    const generation = await this.ctx.service.mediaGeneration.findById(generationId);
    let storyboard = await this.ctx.service.storyboard.findById(id);
    if (!storyboard) throw new Error('storyboard not found');
    try {
      if (preview.use_first_frame && !storyboard.thumbnail_url) {
        await this.ctx.service.storyboardCover.generateCover(id, '', false);
        storyboard = await this.ctx.service.storyboard.findById(id);
        if (!storyboard) throw new Error('storyboard not found');
      }
      const imageInput = preview.use_first_frame
        ? resolveMediaUrl(this.app, storyboard.thumbnail_url)
        : '';
      if (preview.use_first_frame && !imageInput) {
        throw new Error('镜头封面图不可用，无法生成视频');
      }
      const prompt = preview.final_prompt;
      const result = this.ctx.service.storyboardReference.isSeedanceVideoModel(preview.model)
        ? await generateSeedanceVideo(
            this.app,
            prompt,
            imageInput,
            preview.duration,
            preview.use_first_frame,
            (preview.reference_images || []).map((item) => item.url),
            (preview.audio_reference_assets || []).map((item) => item.url),
            preview.resolution,
            preview.audio,
            {
              onTaskCreated: async (taskId: string) => {
                const currentGeneration =
                  await this.ctx.service.mediaGeneration.findById(generationId);
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
            {
              onTaskCreated: async (taskId: string) => {
                const currentGeneration =
                  await this.ctx.service.mediaGeneration.findById(generationId);
                await this.ctx.service.mediaGeneration.update(generationId, {
                  meta_json: {
                    ...parseMediaGenerationMeta(currentGeneration?.meta_json),
                    provider_task_id: taskId,
                  },
                });
              },
            },
          );
      await this.applySucceededVideoGeneration(id, generationId, storyboard, result, {
        sourceUrl: preview.use_first_frame ? storyboard.thumbnail_url : '',
        promptMode: preview.prompt_mode,
        resolution: preview.resolution,
        audio: preview.audio,
        useFirstFrame: preview.use_first_frame,
        firstFrameStatus: preview.source_image_status,
        referenceImageCount: preview.reference_images?.length || 0,
        audioReferenceCount: preview.audio_reference_assets?.length || 0,
        audioReferenceCharacters: (preview.audio_reference_assets || []).map((item) => item.name),
        audioReferenceTotalDuration: preview.audio_reference_total_duration || 0,
      });
    } catch (error) {
      if (isVideoTimeoutError(error)) {
        // 超时不等于失败：云端任务可能仍在执行并最终成功。
        // 落 timeout 态保留续查通道，不清空已有可播放地址。
        await this.ctx.service.storyboard.update(id, {
          video_status: GENERATION_STATUS.TIMEOUT,
          video_error: (error as Error).message,
        });
        await this.ctx.service.mediaGeneration.update(generation.id, {
          status: GENERATION_STATUS.TIMEOUT,
          error_message: (error as Error).message,
        });
        return;
      }
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

  /**
   * 落库一次成功的镜头视频，供初次生成与超时续查共用。
   * @param {number} id 镜头 id，例如 `146`。
   * @param {number} generationId 镜头视频生成记录 id。
   * @param {object} storyboard 镜头对象。
   * @param {{ videoUrl: string; duration: number; taskId?: string }} result 云端终态结果。
   * @param {object} context 落库上下文（首帧地址、提示词模式、分辨率等）。
   * @returns {Promise<void>} 无返回。
   */
  async applySucceededVideoGeneration(
    id: number,
    generationId: number,
    storyboard: { thumbnail_url?: string },
    result: { videoUrl: string; duration: number; taskId?: string },
    context: {
      sourceUrl: string;
      promptMode?: string;
      resolution?: string;
      audio?: boolean;
      useFirstFrame?: boolean;
      firstFrameStatus?: string;
      referenceImageCount?: number;
      audioReferenceCount?: number;
      audioReferenceCharacters?: string[];
      audioReferenceTotalDuration?: number;
    },
  ) {
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
    await this.ctx.service.mediaGeneration.update(generationId, {
      status: GENERATION_STATUS.SUCCEEDED,
      result_url: stored.publicPath,
      preview_url: stored.publicPath,
      source_url: context.sourceUrl,
      error_message: null,
      meta_json: JSON.stringify({
        prompt_mode: context.promptMode,
        resolution: context.resolution,
        duration: result.duration,
        audio: context.audio,
        use_first_frame: context.useFirstFrame,
        first_frame_status: context.firstFrameStatus,
        reference_image_count: context.referenceImageCount || 0,
        audio_reference_count: context.audioReferenceCount || 0,
        audio_reference_characters: context.audioReferenceCharacters || [],
        audio_reference_total_duration: context.audioReferenceTotalDuration || 0,
        provider_task_id: result.taskId || undefined,
      }),
    });
    await this.ctx.service.mediaGeneration.markCurrent(id, MEDIA_TYPE.VIDEO, generationId);
  }

  /**
   * 凭已持久化的云端任务 ID 续查超时任务到终态（超时恢复通道）。
   * 只接受 timeout 态的记录；generating 表示后台仍在等待，直接返回现状。
   * @param {number} id 镜头 id，例如 `146`。
   * @param {number} [generationId] 生成记录 id，不传则取最近一条视频记录。
   * @returns {Promise<object>} 更新后的镜头对象。
   */
  async resumeVideoGeneration(id: number, generationId?: number) {
    const storyboard = await this.ctx.service.storyboard.findById(id);
    if (!storyboard) throw new Error('storyboard not found');
    const generation = generationId
      ? await this.ctx.service.mediaGeneration.findById(generationId)
      : (await this.ctx.service.mediaGeneration.listByStoryboardId(id)).find(
          (item: { media_type?: string }) => item.media_type === MEDIA_TYPE.VIDEO,
        );
    if (!generation || generation.media_type !== MEDIA_TYPE.VIDEO) {
      throw new Error('没有可继续等待的视频任务');
    }
    if (generation.status === GENERATION_STATUS.GENERATING) {
      return { storyboard: await this.ctx.service.storyboard.findById(id), resumed: false };
    }
    if (generation.status !== GENERATION_STATUS.TIMEOUT) {
      throw new Error('该任务不在可继续等待状态');
    }
    const meta = parseMediaGenerationMeta(generation.meta_json);
    const taskId = typeof meta.provider_task_id === 'string' ? meta.provider_task_id : '';
    if (!taskId) {
      throw new Error('该任务缺少云端任务 ID，无法继续等待，请重新生成');
    }
    await this.ctx.service.storyboard.update(id, {
      video_status: GENERATION_STATUS.GENERATING,
      video_error: '',
    });
    await this.ctx.service.mediaGeneration.update(generation.id, {
      status: GENERATION_STATUS.GENERATING,
      error_message: null,
    });
    try {
      const result = this.ctx.service.storyboardReference.isSeedanceVideoModel(generation.model)
        ? await pollSeedanceVideoTask(this.app, taskId)
        : await pollWanxVideoTask(this.app, taskId);
      await this.applySucceededVideoGeneration(id, generation.id, storyboard, result, {
        sourceUrl: generation.source_url || '',
        promptMode: meta.prompt_mode as string | undefined,
        resolution: meta.resolution as string | undefined,
        audio: meta.audio as boolean | undefined,
        useFirstFrame: meta.use_first_frame as boolean | undefined,
        firstFrameStatus: meta.first_frame_status as string | undefined,
        referenceImageCount: meta.reference_image_count as number | undefined,
        audioReferenceCount: meta.audio_reference_count as number | undefined,
        audioReferenceCharacters: meta.audio_reference_characters as string[] | undefined,
        audioReferenceTotalDuration: meta.audio_reference_total_duration as number | undefined,
      });
    } catch (error) {
      if (isVideoTimeoutError(error)) {
        await this.ctx.service.storyboard.update(id, {
          video_status: GENERATION_STATUS.TIMEOUT,
          video_error: (error as Error).message,
        });
        await this.ctx.service.mediaGeneration.update(generation.id, {
          status: GENERATION_STATUS.TIMEOUT,
          error_message: (error as Error).message,
        });
        return { storyboard: await this.ctx.service.storyboard.findById(id), resumed: false };
      }
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
      throw error;
    }
    return { storyboard: await this.ctx.service.storyboard.findById(id), resumed: true };
  }

  async applyMediaGeneration(storyboardId: number, generation: StoryboardMediaGenerationEntity) {
    if (!generation) {
      return await this.ctx.service.storyboard.findById(storyboardId);
    }
    if (generation.media_type === MEDIA_TYPE.COVER) {
      await this.ctx.service.storyboard.update(storyboardId, {
        thumbnail_url: generation.result_url || '',
        thumbnail_preview_url: generation.preview_url || '',
      });
    } else if (generation.media_type === MEDIA_TYPE.VIDEO) {
      const meta = parseMediaGenerationMeta(generation.meta_json);
      await this.ctx.service.storyboard.update(storyboardId, {
        video_url: generation.result_url || '',
        video_preview_url: generation.preview_url || '',
        video_status: generation.result_url ? GENERATION_STATUS.SUCCEEDED : '',
        video_error: '',
        video_duration: Number(meta.duration || 0) || 0,
      });
    }
    return await this.ctx.service.storyboard.findById(storyboardId);
  }
}

module.exports = StoryboardVideoService;
