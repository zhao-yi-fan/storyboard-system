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
import type { CharacterEntity, LibApp, StoryboardAppConfig } from './entity';

/**
 * 视频任务等待窗口耗尽时抛出的错误。
 *
 * 超时只代表“本次等待没有拿到终态”，不代表云端任务失败：
 * 任务可能仍在服务端执行并最终成功。调用方必须将其落为可续查的
 * `timeout` 状态，不得直接记为失败，避免把实际成功的任务误判掉。
 */
export class VideoTimeoutError extends Error {
  readonly code = 'VIDEO_TIMEOUT';
  readonly taskId?: string;
  constructor(message: string, taskId?: string) {
    super(message);
    this.name = 'VideoTimeoutError';
    this.taskId = taskId;
  }
}

export function isVideoTimeoutError(error: unknown): error is VideoTimeoutError {
  return (
    error instanceof VideoTimeoutError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { code?: unknown }).code === 'VIDEO_TIMEOUT')
  );
}

function getConfig(app: LibApp): StoryboardAppConfig {
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
async function generateSeedreamImage(
  app: LibApp,
  prompt: string,
  imageUrls: string[],
  options: { size?: string } = {},
) {
  const cfg = getConfig(app);
  requireValue(cfg.seedreamImageApiKey, 'Seedream 4.5 未配置：缺少 SEEDREAM_IMAGE_API_KEY');
  const seedreamImageApiKey = String(cfg.seedreamImageApiKey || '');
  const baseUrl = normalizeBaseUrl(cfg.seedreamImageBaseUrl, DEFAULT_PROVIDER_BASE_URL.ARK);
  const timeoutMs = resolveTimeoutMs(
    cfg.seedreamImageTimeoutSeconds,
    AI_REQUEST_TIMEOUT.SEEDREAM_SECONDS,
    AI_REQUEST_TIMEOUT.STANDARD_INVALID_VALUE_MS,
  );
  const payload: {
    model: string;
    prompt: string;
    size: string;
    response_format: string;
    watermark: boolean;
    image?: string | string[];
  } = {
    model: String(cfg.seedreamImageModel || DEFAULT_PROVIDER_MODEL.SEEDREAM_IMAGE).trim(),
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
    seedreamImageApiKey,
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
  app: LibApp,
  prompt: string,
  imageUrl: string,
  model: string,
  duration: number,
  useFirstFrame = AI_VIDEO_DEFAULT.USE_FIRST_FRAME,
  options: {
    onTaskCreated?: (taskId: string) => void;
  } = {},
) {
  const cfg = getConfig(app);
  requireValue(cfg.dashScopeApiKey, '镜头视频生成未配置：缺少 DASHSCOPE_API_KEY');
  const dashScopeApiKey = String(cfg.dashScopeApiKey || '');
  const baseUrl = normalizeBaseUrl(cfg.wanxVideoBaseUrl, DEFAULT_PROVIDER_BASE_URL.DASHSCOPE);
  const timeoutMs = resolveTimeoutMs(
    cfg.wanxVideoRequestTimeoutSeconds,
    AI_REQUEST_TIMEOUT.WANX_VIDEO_SECONDS,
    AI_REQUEST_TIMEOUT.STANDARD_INVALID_VALUE_MS,
  );
  const selectedModel = useFirstFrame
    ? String(model || cfg.wanxVideoModel || DEFAULT_PROVIDER_MODEL.WANX_VIDEO).trim()
    : String(cfg.wanxTextVideoModel || DEFAULT_PROVIDER_MODEL.WANX_TEXT_VIDEO).trim();
  const payload: {
    model: string;
    parameters: {
      resolution: string;
      duration: number;
      prompt_extend: boolean;
      watermark: boolean;
      audio: boolean;
    };
    input?: Record<string, unknown>;
  } = {
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
  if (typeof options.onTaskCreated === 'function') {
    try {
      await options.onTaskCreated(taskId);
    } catch (error) {
      app.logger?.error?.(`[Wanx] persist task id failed: ${(error as Error).message}`);
    }
  }

  return await pollWanxTaskResult(
    baseUrl,
    dashScopeApiKey,
    taskId,
    timeoutMs,
    duration || AI_VIDEO_DEFAULT.DURATION_SECONDS,
  );
}

/**
 * 轮询万相视频任务到终态，供初次生成与超时后续查共用。
 * 等待窗口耗尽抛 VideoTimeoutError（不断言失败），云端明确失败才抛普通 Error。
 */
async function pollWanxTaskResult(
  baseUrl: string,
  apiKey: string,
  taskId: string,
  timeoutMs: number,
  fallbackDuration: number,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await wait(AI_POLL_INTERVAL_MS.WANX_VIDEO);
    const taskData = await getJson(`${baseUrl}/tasks/${taskId}`, apiKey, timeoutMs);
    const status = String(taskData?.output?.task_status || '').toUpperCase();
    if (status === AI_TASK_STATUS.WANX_SUCCEEDED) {
      const videoUrl = taskData?.output?.video_url;
      if (!videoUrl) {
        throw new Error('视频任务成功但未返回 video_url');
      }
      const actualDuration = Number(
        taskData?.usage?.output_video_duration ||
          taskData?.usage?.duration ||
          fallbackDuration ||
          AI_VIDEO_DEFAULT.DURATION_SECONDS,
      );
      return { taskId, videoUrl, duration: actualDuration };
    }
    if (status === AI_TASK_STATUS.WANX_FAILED || status === AI_TASK_STATUS.WANX_CANCELED) {
      throw new Error(String(taskData?.output?.message || taskData?.message || '视频任务失败'));
    }
  }
  throw new VideoTimeoutError(
    '视频生成任务已提交但在等待窗口内未完成，任务可能仍在云端执行，可稍后继续等待任务结果',
    taskId,
  );
}

/**
 * 凭已持久化的万相 taskId 续查任务终态（超时恢复通道）。
 * @param {any} app Egg app 实例。
 * @param {string} taskId 云端任务 ID，例如 `"abc-123"`。
 * @returns {Promise<{ taskId: string; videoUrl: string; duration: number }>} 终态结果。
 */
async function pollWanxVideoTask(app: LibApp, taskId: string) {
  const cfg = getConfig(app);
  requireValue(cfg.dashScopeApiKey, '镜头视频生成未配置：缺少 DASHSCOPE_API_KEY');
  const dashScopeApiKey = String(cfg.dashScopeApiKey || '');
  const baseUrl = normalizeBaseUrl(cfg.wanxVideoBaseUrl, DEFAULT_PROVIDER_BASE_URL.DASHSCOPE);
  const timeoutMs = resolveTimeoutMs(
    cfg.wanxVideoRequestTimeoutSeconds,
    AI_REQUEST_TIMEOUT.WANX_VIDEO_SECONDS,
    AI_REQUEST_TIMEOUT.STANDARD_INVALID_VALUE_MS,
  );
  return await pollWanxTaskResult(
    baseUrl,
    dashScopeApiKey,
    taskId,
    timeoutMs,
    AI_VIDEO_DEFAULT.DURATION_SECONDS,
  );
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
}: {
  model: string;
  prompt: string;
  imageUrl?: string;
  duration?: number;
  useFirstFrame?: boolean;
  referenceImageUrls?: string[];
  referenceAudioUrls?: string[];
  resolution?: string;
  aspectRatio?: string;
  generateAudio?: boolean;
}) {
  const normalizedReferenceImages = referenceImageUrls.filter(Boolean);
  const normalizedReferenceAudio = generateAudio ? referenceAudioUrls.filter(Boolean) : [];
  if (useFirstFrame && (normalizedReferenceImages.length || normalizedReferenceAudio.length)) {
    throw new Error('Seedance 2.0 首帧模式不能与角色、场景或音频参考素材混用');
  }
  const content: Array<{
    type: string;
    text?: string;
    role?: string;
    image_url?: { url: string };
    audio_url?: { url: string };
  }> = [{ type: SEEDANCE_CONTENT.TEXT, text: prompt }];
  if (useFirstFrame && String(imageUrl || '').trim()) {
    content.push({
      type: SEEDANCE_CONTENT.IMAGE_URL,
      role: SEEDANCE_CONTENT.FIRST_FRAME,
      image_url: { url: imageUrl as string },
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
  app: LibApp,
  prompt: string,
  imageUrl: string,
  duration: number,
  useFirstFrame = AI_VIDEO_DEFAULT.USE_FIRST_FRAME,
  referenceImageUrls = [],
  referenceAudioUrls = [],
  resolution = AI_VIDEO_DEFAULT.SEEDANCE_RESOLUTION,
  aspectRatio = AI_VIDEO_DEFAULT.ASPECT_RATIO,
  generateAudio = AI_VIDEO_DEFAULT.GENERATE_AUDIO,
  options: {
    onTaskCreated?: (taskId: string) => void;
    pollIntervalMs?: number;
  } = {},
) {
  const cfg = getConfig(app);
  requireValue(cfg.seedanceApiKey, '镜头视频生成未配置：缺少 SEEDANCE_API_KEY');
  const seedanceApiKey = String(cfg.seedanceApiKey || '');
  const baseUrl = normalizeBaseUrl(cfg.seedanceBaseUrl, DEFAULT_PROVIDER_BASE_URL.ARK);
  const timeoutMs = resolveTimeoutMs(
    cfg.seedanceRequestTimeoutSeconds,
    AI_REQUEST_TIMEOUT.SEEDANCE_SECONDS,
    AI_REQUEST_TIMEOUT.STANDARD_INVALID_VALUE_MS,
  );
  const payload = buildSeedanceVideoPayload({
    model: String(cfg.seedanceModel || DEFAULT_PROVIDER_MODEL.SEEDANCE).trim(),
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
      app.logger?.error?.(`[Seedance] persist task id failed: ${(error as Error).message}`);
    }
  }
  const pollIntervalMs = Number.isFinite(Number(options.pollIntervalMs))
    ? Math.max(0, Number(options.pollIntervalMs))
    : AI_POLL_INTERVAL_MS.SEEDANCE_VIDEO;

  // 有界等待：窗口耗尽只停轮询、不判失败，任务可能仍在云端执行，
  // 调用方可凭 taskId 续查。
  return await pollSeedanceTaskResult(
    baseUrl,
    seedanceApiKey,
    taskId,
    timeoutMs,
    pollIntervalMs,
    duration || AI_VIDEO_DEFAULT.DURATION_SECONDS,
    app,
  );
}

/**
 * 轮询 Seedance 视频任务到终态，供初次生成与超时后续查共用。
 * 等待窗口耗尽抛 VideoTimeoutError（不断言失败），云端明确失败才抛普通 Error。
 */
async function pollSeedanceTaskResult(
  baseUrl: string,
  apiKey: string,
  taskId: string,
  timeoutMs: number,
  pollIntervalMs: number,
  fallbackDuration: number,
  app?: LibApp,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await wait(pollIntervalMs);
    let taskData;
    try {
      taskData = await getJson(`${baseUrl}/contents/generations/tasks/${taskId}`, apiKey, timeoutMs);
    } catch (error) {
      if (
        Number((error as { status?: unknown }).status) >= 400 &&
        Number((error as { status?: unknown }).status) < 500
      )
        throw error;
      app?.logger?.warn?.(
        `[Seedance] task ${taskId} poll failed, retrying: ${(error as Error).message}`,
      );
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
        duration: Number(fallbackDuration || AI_VIDEO_DEFAULT.DURATION_SECONDS),
      };
    }
    if (AI_TASK_STATUS.FAILED_ALIASES.includes(status)) {
      throw new Error(String(findFirstMessage(taskData) || 'Seedance 视频任务失败'));
    }
  }
  throw new VideoTimeoutError(
    'Seedance 视频任务已提交但在等待窗口内未完成，任务可能仍在云端执行，可稍后继续等待任务结果',
    taskId,
  );
}

/**
 * 凭已持久化的 Seedance taskId 续查任务终态（超时恢复通道）。
 * @param {any} app Egg app 实例。
 * @param {string} taskId 云端任务 ID，例如 `"abc-123"`。
 * @returns {Promise<{ taskId: string; videoUrl: string; duration: number }>} 终态结果。
 */
async function pollSeedanceVideoTask(app: LibApp, taskId: string) {
  const cfg = getConfig(app);
  requireValue(cfg.seedanceApiKey, '镜头视频生成未配置：缺少 SEEDANCE_API_KEY');
  const seedanceApiKey = String(cfg.seedanceApiKey || '');
  const baseUrl = normalizeBaseUrl(cfg.seedanceBaseUrl, DEFAULT_PROVIDER_BASE_URL.ARK);
  const timeoutMs = resolveTimeoutMs(
    cfg.seedanceRequestTimeoutSeconds,
    AI_REQUEST_TIMEOUT.SEEDANCE_SECONDS,
    AI_REQUEST_TIMEOUT.STANDARD_INVALID_VALUE_MS,
  );
  return await pollSeedanceTaskResult(
    baseUrl,
    seedanceApiKey,
    taskId,
    timeoutMs,
    AI_POLL_INTERVAL_MS.SEEDANCE_VIDEO,
    AI_VIDEO_DEFAULT.DURATION_SECONDS,
    app,
  );
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
async function createCharacterVoicePreview(
  app: LibApp,
  character: Pick<CharacterEntity, 'description' | 'id' | 'name'>,
  customPrompt: string,
  customText: string,
) {
  const cfg = getConfig(app);
  const voicePrompt = withVoiceDurationInstruction(
    buildCharacterVoicePromptText(character, String(customPrompt || '').trim()).prompt,
  );
  const previewText = buildCharacterVoiceReferenceText(character, customText);
  return {
    designModel: String(
      cfg.dashScopeVoiceDesignModel || DEFAULT_PROVIDER_MODEL.DASHSCOPE_VOICE_DESIGN,
    ).trim(),
    targetModel: String(
      cfg.dashScopeVoiceTargetModel || DEFAULT_PROVIDER_MODEL.DASHSCOPE_VOICE_TARGET,
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
async function generateCharacterVoiceReference(
  app: LibApp,
  character: Pick<CharacterEntity, 'description' | 'id' | 'name'>,
  customPrompt: string,
  customText: string,
) {
  const cfg = getConfig(app);
  requireValue(cfg.dashScopeApiKey, '角色主语音参考生成未配置：缺少 DASHSCOPE_API_KEY');
  const preview = await createCharacterVoicePreview(app, character, customPrompt, customText);
  const timeoutMs = resolveTimeoutMs(
    cfg.dashScopeVoiceRequestTimeoutSeconds,
    AI_REQUEST_TIMEOUT.VOICE_SECONDS,
    AI_REQUEST_TIMEOUT.VOICE_INVALID_VALUE_MS,
  );
  const baseUrl = normalizeBaseUrl(cfg.dashScopeVoiceBaseUrl, DEFAULT_PROVIDER_BASE_URL.DASHSCOPE);
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

function preferredVoiceName(character: Pick<CharacterEntity, 'id' | 'name'>) {
  // Qwen preferred_name 上限 16 字符：token 预算随 id 位数动态收缩，总长恒不超过上限。
  const idSuffix = String(character?.id ?? '');
  const tokenBudget = Math.max(
    1,
    Math.min(AI_VOICE_DEFAULT.PREFERRED_NAME_MAX_LENGTH, 16 - 1 - idSuffix.length),
  );
  const token =
    String(character?.name || AI_VOICE_DEFAULT.PREFERRED_NAME_FALLBACK)
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, tokenBudget) || AI_VOICE_DEFAULT.PREFERRED_NAME_FALLBACK;
  return `${token}_${idSuffix}`;
}

function withVoiceDurationInstruction(prompt: unknown) {
  const text = String(prompt || '').trim();
  if (!text) {
    return AI_VOICE_DEFAULT.DURATION_INSTRUCTION;
  }
  if (/3\s*[-~—至到]\s*5\s*秒/.test(text)) {
    return text;
  }
  return `${text}\n${AI_VOICE_DEFAULT.DURATION_INSTRUCTION}`;
}

const VOICE_PREVIEW_TEXT_MAX_LENGTH = 50;

function buildCharacterVoiceReferenceText(_character: unknown, customText?: string) {
  const custom = String(customText || '').trim();
  if (!custom) return AI_VOICE_DEFAULT.REFERENCE_TEXT;
  return custom.slice(0, VOICE_PREVIEW_TEXT_MAX_LENGTH);
}

module.exports = {
  VideoTimeoutError,
  isVideoTimeoutError,
  generateSeedreamImage,
  SEEDREAM_DESIGN_SHEET_SIZE: AI_IMAGE_SIZE.CHARACTER_DESIGN_SHEET,
  generateWanxVideo,
  generateSeedanceVideo,
  pollWanxVideoTask,
  pollSeedanceVideoTask,
  buildSeedanceVideoPayload,
  createCharacterVoicePreview,
  generateCharacterVoiceReference,
};
