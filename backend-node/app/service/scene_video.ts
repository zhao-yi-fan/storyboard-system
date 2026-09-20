'use strict';

const Service = require('egg').Service;

const {
  sanitizeFileName,
  downloadAndStore,
  composeVideos,
  resolveMediaUrl,
} = require('../lib/media');
const { generateWanxVideo, generateSeedanceVideo } = require('../lib/ai_clients');
const {
  assertCompositePromptLength,
  buildCompositeVideoPrompt,
} = require('../lib/composite_prompt');
const { parseMediaGenerationMeta } = require('../lib/media_generation_meta');
import type { SceneVideoPreview } from '../lib/entity';
const { GENERATION_STATUS, MEDIA_TYPE, VIDEO_MODEL } = require('../lib/domain_constants');

class SceneVideoService extends Service {
  async previewVideoGeneration(
    id: number,
    selectedModel: string,
    duration: number | null,
    useFirstFrameRaw: boolean,
    resolutionRaw: string,
    aspectRatioRaw: string,
    generateAudioRaw: boolean,
  ) {
    const scene = await this.ctx.service.scene.findById(id);
    if (!scene) throw new Error('scene not found');
    const prompt = assertCompositePromptLength(scene.prompt || '');
    if (!prompt) throw new Error('片段 Prompt 不能为空');
    const helper = this.ctx.service.storyboardReference;
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
      ...this.ctx.service.sceneReference.buildVideoFrameReferences(
        scene.video_frame_references || [],
      ),
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

  async generateVideo(
    id: number,
    model: string,
    duration: number,
    useFirstFrame: boolean,
    resolution: string,
    aspectRatio: string,
    generateAudio: boolean,
  ) {
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
    const current = await this.ctx.service.scene.findById(id);
    if (!current) throw new Error('scene not found');
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
    await this.ctx.service.scene.update(id, {
      generation_duration: preview.duration,
      video_status: GENERATION_STATUS.GENERATING,
      video_error: '',
    });
    void this.generateVideoAsync(id, preview, generation.id).catch((error: unknown) =>
      this.ctx.logger.error(error),
    );
    return { scene_id: id, scene: await this.ctx.service.scene.findById(id) };
  }

  async generateVideoAsync(id: number, preview: SceneVideoPreview, generationId: number) {
    let scene = await this.ctx.service.scene.findById(id);
    if (!scene) throw new Error('scene not found');
    try {
      if (preview.use_first_frame && !scene.cover_url) {
        await this.ctx.service.sceneCover.generateCover(id, '', false);
        scene = await this.ctx.service.scene.findById(id);
        if (!scene) throw new Error('scene not found');
      }
      const imageInput = preview.use_first_frame ? resolveMediaUrl(this.app, scene.cover_url) : '';
      if (preview.use_first_frame && !imageInput) {
        throw new Error('片段首帧不可用，无法生成视频');
      }
      const result = this.ctx.service.storyboardReference.isSeedanceVideoModel(preview.model)
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
              onTaskCreated: async (taskId: string) => {
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
      await this.ctx.service.scene.update(id, {
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
      await this.ctx.service.scene.update(id, { video_poster_url: posterUrl });
      await this.ctx.service.sceneMediaGeneration.markCurrent(id, MEDIA_TYPE.VIDEO, generationId);
    } catch (error) {
      await this.ctx.service.scene.update(id, {
        video_url: '',
        video_preview_url: '',
        video_poster_url: '',
        video_status: GENERATION_STATUS.FAILED,
        video_error: (error as Error).message,
      });
      await this.ctx.service.sceneMediaGeneration.update(generationId, {
        status: GENERATION_STATUS.FAILED,
        error_message: (error as Error).message,
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
  async composeVideo(id: number, regenerate: boolean) {
    const scene = await this.ctx.service.scene.findById(id);
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
    await this.ctx.service.scene.update(id, {
      video_status: GENERATION_STATUS.GENERATING,
      video_error: '',
    });
    try {
      const filename = `${sanitizeFileName(`scene-${id}`)}-${Date.now()}.mp4`;
      const composed = await composeVideos(
        this.app,
        inputs.map((item: { source: string }) => item.source),
        'scene-videos',
        filename,
      );
      const nextScene = await this.ctx.service.scene.update(id, {
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
      const sceneWithPoster = await this.ctx.service.scene.update(id, {
        video_poster_url: posterUrl,
      });
      await this.ctx.service.sceneMediaGeneration.markCurrent(id, MEDIA_TYPE.VIDEO, generation.id);
      return posterUrl ? sceneWithPoster : nextScene;
    } catch (error) {
      await this.ctx.service.scene.update(id, {
        video_status: GENERATION_STATUS.FAILED,
        video_error: (error as Error).message,
      });
      throw error;
    }
  }
}

module.exports = SceneVideoService;
