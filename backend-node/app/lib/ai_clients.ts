// @ts-nocheck
'use strict';

const {
  DEFAULT_PROVIDER_BASE_URL,
  DEFAULT_PROVIDER_MODEL,
} = require('../../config/shared/constants');
const {
  AI_HTTP,
  AI_IMAGE_DEFAULT,
  AI_IMAGE_SIZE,
  AI_POLL_INTERVAL_MS,
  AI_REQUEST_TIMEOUT,
  AI_TASK_STATUS,
  AI_VIDEO_DEFAULT,
  AI_VOICE_DEFAULT,
  SEEDANCE_CONTENT,
  WANX_MEDIA_TYPE,
} = require('./ai_client_constants');
const {
  findFirstMessage,
  findFirstVideoUrl,
  getJson,
  normalizeBaseUrl,
  postJson,
  requireValue,
  resolveTimeoutMs,
  wait,
} = require('./ai_client_http');
const { buildCharacterVoicePromptText } = require('./prompt_library');

function getConfig(app) {
  return app.config.storyboard || {};
}

/**
 * 调用 Seedream 图像生成接口，支持文生图和图生图。
 * @param {any} app Egg app 实例。
 * @param {string} prompt 最终提示词，例如 `"生成高细节角色主设定板"`。
 * @param {string[]} imageUrls 参考图 URL 数组，例如 `["https://role-ref.png", "https://layout-ref.png"]`。
 * @param {{ size?: string }} options 额外参数，例如 `{ size: "1600x2304" }`。
 * @returns {Promise<string>} 远端返回的图片 URL。
 * @example
 * await generateSeedreamImage(app, "生成高细节角色主设定板", ["https://role-ref.png"], { size: "1600x2304" })
 * // => "https://..."
 */
async function generateSeedreamImage(app, prompt, imageUrls, options = {}) {
  const cfg = getConfig(app);
  requireValue(cfg.seedreamImageApiKey, 'Seedream 4.5 未配置：缺少 SEEDREAM_IMAGE_API_KEY');
  const baseUrl = normalizeBaseUrl(
    cfg.seedreamImageBaseUrl,
    DEFAULT_PROVIDER_BASE_URL.ARK,
  );
  const timeoutMs = resolveTimeoutMs(
    cfg.seedreamImageTimeoutSeconds,
    AI_REQUEST_TIMEOUT.SEEDREAM_SECONDS,
    AI_REQUEST_TIMEOUT.STANDARD_INVALID_VALUE_MS,
  );
  const payload = {
    model: String(
      cfg.seedreamImageModel || DEFAULT_PROVIDER_MODEL.SEEDREAM_IMAGE,
    ).trim(),
    prompt: String(prompt || '').trim(),
    size: String(options.size || AI_IMAGE_SIZE.STORYBOARD_COVER).trim(),
    response_format: AI_IMAGE_DEFAULT.RESPONSE_FORMAT,
    watermark: AI_IMAGE_DEFAULT.WATERMARK,
  };
  const refs = imageUrls.filter(Boolean);
  if (refs.length === 1) {
    payload.image = refs[0];
  } else if (refs.length > 1) {
    payload.image = refs;
  }
  const data = await postJson(
    `${baseUrl}/images/generations`,
    cfg.seedreamImageApiKey,
    payload,
    timeoutMs,
  );
  const image = data?.data?.data?.[0]?.url || data?.data?.[0]?.url;
  if (!image) {
    throw new Error('Seedream 4.5 生图成功但未返回图片 URL');
  }
  return image;
}

/**
 * 调用万相视频模型生成镜头视频。
 * @param {any} app Egg app 实例。
 * @param {string} prompt 最终提示词，例如 `"镜头缓慢推进，李明抬头"`。
 * @param {string} imageUrl 首帧图 URL，例如 `"https://cover.png"`。
 * @param {string} model 模型名，例如 `"wan2.7-i2v"`。
 * @param {number} duration 时长秒数，例如 `5`。
 * @param {boolean} useFirstFrame 是否使用首帧图。
 * @returns {Promise<string>} 最终视频 URL。
 * @example
 * await generateWanxVideo(app, "镜头缓慢推进，李明抬头", "https://cover.png", "wan2.7-i2v", 5, true)
 * // => "https://..."
 */
async function generateWanxVideo(
  app,
  prompt,
  imageUrl,
  model,
  duration,
  useFirstFrame = AI_VIDEO_DEFAULT.USE_FIRST_FRAME,
) {
  const cfg = getConfig(app);
  requireValue(cfg.dashScopeApiKey, '镜头视频生成未配置：缺少 DASHSCOPE_API_KEY');
  const baseUrl = normalizeBaseUrl(
    cfg.wanxVideoBaseUrl,
    DEFAULT_PROVIDER_BASE_URL.DASHSCOPE,
  );
  const timeoutMs = resolveTimeoutMs(
    cfg.wanxVideoRequestTimeoutSeconds,
    AI_REQUEST_TIMEOUT.WANX_VIDEO_SECONDS,
    AI_REQUEST_TIMEOUT.STANDARD_INVALID_VALUE_MS,
  );
  const selectedModel = useFirstFrame
    ? String(
        model ||
          cfg.wanxVideoModel ||
          DEFAULT_PROVIDER_MODEL.WANX_VIDEO,
      ).trim()
    : String(
        cfg.wanxTextVideoModel || DEFAULT_PROVIDER_MODEL.WANX_TEXT_VIDEO,
      ).trim();
  const payload = {
    model: selectedModel,
    parameters: {
      resolution: AI_VIDEO_DEFAULT.WANX_RESOLUTION,
      duration: duration || AI_VIDEO_DEFAULT.DURATION_SECONDS,
      prompt_extend: AI_VIDEO_DEFAULT.PROMPT_EXTEND,
      watermark: AI_VIDEO_DEFAULT.WATERMARK,
      audio: AI_VIDEO_DEFAULT.GENERATE_AUDIO,
    },
  };
  if (!useFirstFrame) {
    payload.input = { prompt };
  } else if (selectedModel === DEFAULT_PROVIDER_MODEL.WANX_VIDEO) {
    payload.input = {
      prompt,
      media: [{ type: WANX_MEDIA_TYPE.FIRST_FRAME, url: imageUrl }],
    };
  } else {
    payload.input = { prompt, img_url: imageUrl };
  }
  const response = await fetch(`${baseUrl}/services/aigc/video-generation/video-synthesis`, {
    method: AI_HTTP.POST_METHOD,
    headers: {
      Authorization: `Bearer ${cfg.dashScopeApiKey}`,
      'Content-Type': AI_HTTP.JSON_CONTENT_TYPE,
      [AI_HTTP.DASHSCOPE_ASYNC_HEADER]: AI_HTTP.DASHSCOPE_ASYNC_VALUE,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const createData = await response.json();
  if (!response.ok) {
    throw new Error(String(createData?.message || createData?.output?.message || response.status));
  }
  const taskId = createData?.output?.task_id;
  if (!taskId) {
    throw new Error('提交视频生成任务失败: 未返回 task_id');
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await wait(AI_POLL_INTERVAL_MS.WANX_VIDEO);
    const taskData = await getJson(`${baseUrl}/tasks/${taskId}`, cfg.dashScopeApiKey, timeoutMs);
    const status = String(taskData?.output?.task_status || '').toUpperCase();
    if (status === AI_TASK_STATUS.WANX_SUCCEEDED) {
      const videoUrl = taskData?.output?.video_url;
      if (!videoUrl) {
        throw new Error('视频任务成功但未返回 video_url');
      }
      const actualDuration = Number(
        taskData?.usage?.output_video_duration ||
          taskData?.usage?.duration ||
          duration ||
          AI_VIDEO_DEFAULT.DURATION_SECONDS,
      );
      return { videoUrl, duration: actualDuration };
    }
    if (
      status === AI_TASK_STATUS.WANX_FAILED ||
      status === AI_TASK_STATUS.WANX_CANCELED
    ) {
      throw new Error(String(taskData?.output?.message || taskData?.message || '视频任务失败'));
    }
  }
  throw new Error('视频生成任务超时');
}

/**
 * 调用 Seedance 视频模型生成镜头视频。
 * @param {any} app Egg app 实例。
 * @param {string} prompt 最终提示词，例如 `"金色粒子汇聚，神女结印"`。
 * @param {string} imageUrl 首帧图 URL，例如 `"https://cover.png"`。
 * @param {number} duration 时长秒数，例如 `5`。
 * @param {boolean} useFirstFrame 是否使用首帧图。
 * @param {string[]} referenceImageUrls 额外参考图 URL 数组。
 * @param {string[]} referenceAudioUrls 角色参考音频 URL 数组。
 * @returns {Promise<string>} 最终视频 URL。
 * @example
 * await generateSeedanceVideo(app, "金色粒子汇聚，神女结印", "https://cover.png", 5, true, [], ["https://voice.wav"])
 * // => "https://..."
 */
function buildSeedanceVideoPayload({
  model,
  prompt,
  imageUrl,
  duration,
  useFirstFrame = AI_VIDEO_DEFAULT.USE_FIRST_FRAME,
  referenceImageUrls = [],
  referenceAudioUrls = [],
  resolution = AI_VIDEO_DEFAULT.SEEDANCE_RESOLUTION,
  aspectRatio = AI_VIDEO_DEFAULT.ASPECT_RATIO,
  generateAudio = AI_VIDEO_DEFAULT.GENERATE_AUDIO,
}) {
  const normalizedReferenceImages = referenceImageUrls.filter(Boolean);
  const normalizedReferenceAudio = generateAudio ? referenceAudioUrls.filter(Boolean) : [];
  if (useFirstFrame && (normalizedReferenceImages.length || normalizedReferenceAudio.length)) {
    throw new Error('Seedance 2.0 首帧模式不能与角色、场景或音频参考素材混用');
  }
  const content = [{ type: SEEDANCE_CONTENT.TEXT, text: prompt }];
  if (useFirstFrame && String(imageUrl || '').trim()) {
    content.push({
      type: SEEDANCE_CONTENT.IMAGE_URL,
      role: SEEDANCE_CONTENT.FIRST_FRAME,
      image_url: { url: imageUrl },
    });
  }
  for (const url of normalizedReferenceImages) {
    content.push({
      type: SEEDANCE_CONTENT.IMAGE_URL,
      role: SEEDANCE_CONTENT.REFERENCE_IMAGE,
      image_url: { url },
    });
  }
  if (generateAudio) {
    for (const url of normalizedReferenceAudio) {
      content.push({
        type: SEEDANCE_CONTENT.AUDIO_URL,
        role: SEEDANCE_CONTENT.REFERENCE_AUDIO,
        audio_url: { url },
      });
    }
  }
  return {
    model,
    content,
    duration: duration || AI_VIDEO_DEFAULT.DURATION_SECONDS,
    resolution,
    aspect_ratio: aspectRatio,
    generate_audio: Boolean(generateAudio),
  };
}

async function generateSeedanceVideo(
  app,
  prompt,
  imageUrl,
  duration,
  useFirstFrame = AI_VIDEO_DEFAULT.USE_FIRST_FRAME,
  referenceImageUrls = [],
  referenceAudioUrls = [],
  resolution = AI_VIDEO_DEFAULT.SEEDANCE_RESOLUTION,
  aspectRatio = AI_VIDEO_DEFAULT.ASPECT_RATIO,
  generateAudio = AI_VIDEO_DEFAULT.GENERATE_AUDIO,
  options = {},
) {
  const cfg = getConfig(app);
  requireValue(cfg.seedanceApiKey, '镜头视频生成未配置：缺少 SEEDANCE_API_KEY');
  const baseUrl = normalizeBaseUrl(
    cfg.seedanceBaseUrl,
    DEFAULT_PROVIDER_BASE_URL.ARK,
  );
  const timeoutMs = resolveTimeoutMs(
    cfg.seedanceRequestTimeoutSeconds,
    AI_REQUEST_TIMEOUT.SEEDANCE_SECONDS,
    AI_REQUEST_TIMEOUT.STANDARD_INVALID_VALUE_MS,
  );
  const payload = buildSeedanceVideoPayload({
    model: String(
      cfg.seedanceModel || DEFAULT_PROVIDER_MODEL.SEEDANCE,
    ).trim(),
    prompt,
    imageUrl,
    duration,
    useFirstFrame,
    referenceImageUrls,
    referenceAudioUrls,
    resolution,
    aspectRatio,
    generateAudio,
  });
  if (payload.model.includes('1-5') || payload.model.includes('1.5')) {
    throw new Error(
      `Seedance 2.0 生成未配置正确模型 ID，请将 SEEDANCE_MODEL 设置为 ${DEFAULT_PROVIDER_MODEL.SEEDANCE}`,
    );
  }
  const createData = await postJson(
    `${baseUrl}/contents/generations/tasks`,
    cfg.seedanceApiKey,
    payload,
    timeoutMs,
  );
  const taskId = createData?.id;
  if (!taskId) {
    throw new Error('提交 Seedance 视频任务失败: 未返回任务 ID');
  }
  if (typeof options.onTaskCreated === 'function') {
    try {
      await options.onTaskCreated(taskId);
    } catch (error) {
      app.logger?.error?.(`[Seedance] persist task id failed: ${error.message}`);
    }
  }
  const pollIntervalMs = Number.isFinite(Number(options.pollIntervalMs))
    ? Math.max(0, Number(options.pollIntervalMs))
    : AI_POLL_INTERVAL_MS.SEEDANCE_VIDEO;

  while (true) {
    await wait(pollIntervalMs);
    let taskData;
    try {
      taskData = await getJson(
        `${baseUrl}/contents/generations/tasks/${taskId}`,
        cfg.seedanceApiKey,
        timeoutMs,
      );
    } catch (error) {
      if (Number(error.status) >= 400 && Number(error.status) < 500) throw error;
      app.logger?.warn?.(`[Seedance] task ${taskId} poll failed, retrying: ${error.message}`);
      continue;
    }
    const status = String(taskData?.status || '').toLowerCase();
    if (AI_TASK_STATUS.SUCCEEDED_ALIASES.includes(status)) {
      const videoUrl = findFirstVideoUrl(taskData);
      if (!videoUrl) {
        throw new Error('Seedance 视频任务成功但未返回视频地址');
      }
      return {
        taskId,
        videoUrl,
        duration: Number(duration || AI_VIDEO_DEFAULT.DURATION_SECONDS),
      };
    }
    if (AI_TASK_STATUS.FAILED_ALIASES.includes(status)) {
      throw new Error(String(findFirstMessage(taskData) || 'Seedance 视频任务失败'));
    }
  }
}

/**
 * 生成角色主语音参考的预览参数，不真正落库。
 * @param {any} app Egg app 实例。
 * @param {object} character 角色对象，例如 `{ name: "林婉", description: "温婉端庄" }`。
 * @param {string} customPrompt 自定义声音提示词。
 * @param {string} customText 自定义参考台词。
 * @returns {Promise<object>} 预览配置对象。
 * @example
 * await createCharacterVoicePreview(app, { name: "林婉", description: "温婉端庄" }, "年轻女性，温柔克制", "今晚你先走。")
 * // => { voicePrompt: "...", previewText: "今晚你先走。", targetModel: "qwen3-tts-vd-2026-01-26" }
 */
async function createCharacterVoicePreview(app, character, customPrompt, _customText) {
  const cfg = getConfig(app);
  const voicePrompt = withVoiceDurationInstruction(
    buildCharacterVoicePromptText(character, String(customPrompt || '').trim()).prompt,
  );
  const previewText = buildCharacterVoiceReferenceText(character);
  return {
    designModel: String(
      cfg.dashScopeVoiceDesignModel ||
        DEFAULT_PROVIDER_MODEL.DASHSCOPE_VOICE_DESIGN,
    ).trim(),
    targetModel: String(
      cfg.dashScopeVoiceTargetModel ||
        DEFAULT_PROVIDER_MODEL.DASHSCOPE_VOICE_TARGET,
    ).trim(),
    voicePrompt,
    previewText,
    preferredVoiceName: preferredVoiceName(character),
  };
}

/**
 * 真正调用语音模型生成角色主语音参考。
 * @param {any} app Egg app 实例。
 * @param {object} character 角色对象，例如 `{ name: "林婉", description: "温婉端庄" }`。
 * @param {string} customPrompt 自定义声音提示词。
 * @param {string} customText 自定义参考台词。
 * @returns {Promise<object>} 音频 buffer、音色信息和最终提示词。
 * @example
 * await generateCharacterVoiceReference(app, { name: "林婉", description: "温婉端庄" }, "年轻女性，温柔克制", "今晚你先走。")
 * // => { audioBuffer: <Buffer ...>, voiceName: "...", voicePrompt: "..." }
 */
async function generateCharacterVoiceReference(app, character, customPrompt, customText) {
  const cfg = getConfig(app);
  requireValue(cfg.dashScopeApiKey, '角色主语音参考生成未配置：缺少 DASHSCOPE_API_KEY');
  const preview = await createCharacterVoicePreview(app, character, customPrompt, customText);
  const timeoutMs = resolveTimeoutMs(
    cfg.dashScopeVoiceRequestTimeoutSeconds,
    AI_REQUEST_TIMEOUT.VOICE_SECONDS,
    AI_REQUEST_TIMEOUT.VOICE_INVALID_VALUE_MS,
  );
  const baseUrl = normalizeBaseUrl(
    cfg.dashScopeVoiceBaseUrl,
    DEFAULT_PROVIDER_BASE_URL.DASHSCOPE,
  );
  const data = await postJson(
    `${baseUrl}/services/audio/tts/customization`,
    cfg.dashScopeApiKey,
    {
      model: preview.designModel,
      input: {
        action: 'create',
        target_model: preview.targetModel,
        voice_prompt: preview.voicePrompt,
        preview_text: preview.previewText,
        preferred_name: preview.preferredVoiceName,
        language: AI_VOICE_DEFAULT.LANGUAGE,
      },
      parameters: {
        sample_rate: AI_VOICE_DEFAULT.SAMPLE_RATE,
        response_format: AI_VOICE_DEFAULT.RESPONSE_FORMAT,
      },
    },
    timeoutMs,
  );

  const voiceName = data?.output?.voice;
  const audioB64 = data?.output?.preview_audio?.data;
  if (!voiceName || !audioB64) {
    throw new Error('生成主语音参考失败: 返回结果缺少音色或音频数据');
  }
  return {
    voiceName,
    voicePrompt: preview.voicePrompt,
    voiceReferenceText: preview.previewText,
    audioBuffer: Buffer.from(audioB64, 'base64'),
    extension: AI_VOICE_DEFAULT.RESPONSE_FORMAT,
  };
}

function preferredVoiceName(character) {
  const token =
    String(character?.name || AI_VOICE_DEFAULT.PREFERRED_NAME_FALLBACK)
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, AI_VOICE_DEFAULT.PREFERRED_NAME_MAX_LENGTH) ||
    AI_VOICE_DEFAULT.PREFERRED_NAME_FALLBACK;
  return `${token}_${character.id}`;
}

function withVoiceDurationInstruction(prompt) {
  const text = String(prompt || '').trim();
  if (!text) {
    return AI_VOICE_DEFAULT.DURATION_INSTRUCTION;
  }
  if (/3\s*[-~—至到]\s*5\s*秒/.test(text)) {
    return text;
  }
  return `${text}\n${AI_VOICE_DEFAULT.DURATION_INSTRUCTION}`;
}

function buildCharacterVoiceReferenceText(_character) {
  return AI_VOICE_DEFAULT.REFERENCE_TEXT;
}

module.exports = {
  generateSeedreamImage,
  SEEDREAM_DESIGN_SHEET_SIZE: AI_IMAGE_SIZE.CHARACTER_DESIGN_SHEET,
  generateWanxVideo,
  generateSeedanceVideo,
  buildSeedanceVideoPayload,
  createCharacterVoicePreview,
  generateCharacterVoiceReference,
};
