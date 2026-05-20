// @ts-nocheck
'use strict';

const JSON_CONTENT_TYPE = 'application/json';
const POST_METHOD = 'POST';
const HTTP_PROTOCOL_PATTERN = /^https?:\/\//;
const MP4_SUFFIX = '.mp4';

const HTTP_STATUS_KEYS = [ 'message', 'msg' ];
const SUCCESS_VIDEO_STATUSES = [ 'succeeded', 'success', 'completed' ];
const FAILED_VIDEO_STATUSES = [ 'failed', 'error', 'canceled', 'cancelled' ];

const DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1';
const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

const DEFAULT_IMAGE_TIMEOUT_MS = 300 * 1000;
const DEFAULT_VIDEO_TIMEOUT_MS = 300 * 1000;
const DEFAULT_AUDIO_TIMEOUT_MS = 120 * 1000;
const DEFAULT_IMAGE_DURATION_SECONDS = 5;
const DEFAULT_POLL_INTERVAL_MS = 15000;
const DEFAULT_SEEDANCE_POLL_INTERVAL_MS = 10000;

const WANX_IMAGE_SIZE = '1024*576';
const SEEDREAM_IMAGE_SIZE = '2560x1440';
const OPENAI_IMAGE_SIZE = '1536x1024';
const VIDEO_RESOLUTION_720P = '720P';
const VIDEO_RESOLUTION_480P = '480p';
const VOICE_RESPONSE_FORMAT_WAV = 'wav';
const VOICE_LANGUAGE_ZH = 'zh';

const NEGATIVE_PROMPT = '低分辨率，低画质，构图混乱，文字模糊，水印，过度AI感，肢体畸形';
const DEFAULT_SEEDREAM_MODEL = 'doubao-seedream-4-5-251128';
const DEFAULT_OPENAI_IMAGE_MODEL = 'gpt-image-2';
const DEFAULT_WANX_VIDEO_MODEL = 'wan2.7-i2v';
const DEFAULT_SEEDANCE_MODEL = 'doubao-seedance-1-5-pro-251215';
const DEFAULT_DASHSCOPE_VOICE_DESIGN_MODEL = 'qwen-voice-design';
const DEFAULT_DASHSCOPE_VOICE_TARGET_MODEL = 'qwen3-tts-vd-2026-01-26';

function getConfig(app) {
  return app.config.storyboard || {};
}

async function postJson(url, apiKey, payload, timeoutMs) {
  const response = await fetch(url, {
    method: POST_METHOD,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': JSON_CONTENT_TYPE,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let data = {};
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`non-json response: HTTP ${response.status}`);
    }
  }
  if (!response.ok) {
    const message = data?.error?.message || data?.message || `${response.status}`;
    throw new Error(String(message));
  }
  return data;
}

async function getJson(url, apiKey, timeoutMs) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let data = {};
  if (text.trim()) {
    data = JSON.parse(text);
  }
  if (!response.ok) {
    throw new Error(String(data?.error?.message || data?.message || response.status));
  }
  return data;
}

function requireValue(value, message) {
  if (!String(value || '').trim()) {
    throw new Error(message);
  }
}

function normalizeBaseUrl(value, fallback) {
  return String(value || fallback).replace(/\/$/, '');
}

function resolveTimeoutMs(value, fallbackSeconds, fallbackTimeoutMs) {
  return Number(value || fallbackSeconds) * 1000 || fallbackTimeoutMs;
}

async function wait(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function generateWanxImage(app, prompt, model) {
  const cfg = getConfig(app);
  requireValue(cfg.dashScopeApiKey, '场景封面生成未配置：缺少 DASHSCOPE_API_KEY');
  const selectedModel = String(model || cfg.wanxModel || 'qwen-image-2.0').trim();
  const timeoutMs = resolveTimeoutMs(cfg.wanxRequestTimeoutSeconds, 300, DEFAULT_IMAGE_TIMEOUT_MS);
  const baseUrl = normalizeBaseUrl(cfg.wanxBaseUrl, DASHSCOPE_BASE_URL);

  const payload = {
    model: selectedModel,
    input: {
      messages: [{
        role: 'user',
        content: [{ type: 'text', text: prompt }],
      }],
    },
    parameters: {
      negative_prompt: NEGATIVE_PROMPT,
      prompt_extend: false,
      watermark: false,
      size: WANX_IMAGE_SIZE,
    },
  };

  const data = await postJson(`${baseUrl}/services/aigc/multimodal-generation/generation`, cfg.dashScopeApiKey, payload, timeoutMs);
  const image = data?.output?.choices?.[0]?.message?.content?.find(item => item.image)?.image;
  if (!image) {
    throw new Error('万相生图成功但未返回图片 URL');
  }
  return image;
}

async function generateWanxImageWithReferences(app, prompt, imageUrls, model) {
  const cfg = getConfig(app);
  requireValue(cfg.dashScopeApiKey, '场景封面生成未配置：缺少 DASHSCOPE_API_KEY');
  const selectedModel = String(model || cfg.wanxReferenceModel || 'wan2.7-image-pro').trim();
  const timeoutMs = resolveTimeoutMs(cfg.wanxRequestTimeoutSeconds, 300, DEFAULT_IMAGE_TIMEOUT_MS);
  const baseUrl = normalizeBaseUrl(cfg.wanxBaseUrl, DASHSCOPE_BASE_URL);
  const payload = {
    model: selectedModel,
    input: {
      messages: [{
        role: 'user',
        content: [
          ...imageUrls.filter(Boolean).map(url => ({ type: 'image', image: url })),
          { type: 'text', text: prompt },
        ],
      }],
    },
    parameters: {
      negative_prompt: NEGATIVE_PROMPT,
      prompt_extend: false,
      watermark: false,
      size: WANX_IMAGE_SIZE,
    },
  };
  const data = await postJson(`${baseUrl}/services/aigc/multimodal-generation/generation`, cfg.dashScopeApiKey, payload, timeoutMs);
  const image = data?.output?.choices?.[0]?.message?.content?.find(item => item.image)?.image;
  if (!image) {
    throw new Error('参考图生图成功但未返回图片 URL');
  }
  return image;
}

async function generateSeedreamImage(app, prompt, imageUrls) {
  const cfg = getConfig(app);
  requireValue(cfg.seedreamImageApiKey, 'Seedream 4.5 未配置：缺少 SEEDREAM_IMAGE_API_KEY');
  const baseUrl = normalizeBaseUrl(cfg.seedreamImageBaseUrl, ARK_BASE_URL);
  const timeoutMs = resolveTimeoutMs(cfg.seedreamImageTimeoutSeconds, 180, DEFAULT_IMAGE_TIMEOUT_MS);
  const payload = {
    model: String(cfg.seedreamImageModel || DEFAULT_SEEDREAM_MODEL).trim(),
    prompt: String(prompt || '').trim(),
    size: SEEDREAM_IMAGE_SIZE,
    response_format: 'url',
    watermark: false,
  };
  const refs = imageUrls.filter(Boolean);
  if (refs.length === 1) {
    payload.image = refs[0];
  } else if (refs.length > 1) {
    payload.image = refs;
  }
  const data = await postJson(`${baseUrl}/images/generations`, cfg.seedreamImageApiKey, payload, timeoutMs);
  const image = data?.data?.data?.[0]?.url || data?.data?.[0]?.url;
  if (!image) {
    throw new Error('Seedream 4.5 生图成功但未返回图片 URL');
  }
  return image;
}

async function generateOpenAIImage(app, prompt, model) {
  const cfg = getConfig(app);
  requireValue(cfg.openAiApiKey, 'GPT Image 2 未配置：缺少 OPENAI_API_KEY');
  const baseUrl = normalizeBaseUrl(cfg.openAiImageBaseUrl, OPENAI_BASE_URL);
  const timeoutMs = resolveTimeoutMs(cfg.openAiImageTimeoutSeconds, 180, DEFAULT_IMAGE_TIMEOUT_MS);
  const payload = {
    model: String(model || cfg.openAiImageModel || DEFAULT_OPENAI_IMAGE_MODEL).trim(),
    prompt,
    size: OPENAI_IMAGE_SIZE,
    quality: 'medium',
    output_format: 'png',
    background: 'opaque',
    n: 1,
  };
  const data = await postJson(`${baseUrl}/images/generations`, cfg.openAiApiKey, payload, timeoutMs);
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('GPT Image 2 成功响应但未返回图片内容');
  }
  return Buffer.from(b64, 'base64');
}

async function generateWanxVideo(app, prompt, imageUrl, model, duration) {
  const cfg = getConfig(app);
  requireValue(cfg.dashScopeApiKey, '镜头视频生成未配置：缺少 DASHSCOPE_API_KEY');
  const baseUrl = normalizeBaseUrl(cfg.wanxVideoBaseUrl, DASHSCOPE_BASE_URL);
  const timeoutMs = resolveTimeoutMs(cfg.wanxVideoRequestTimeoutSeconds, 300, DEFAULT_VIDEO_TIMEOUT_MS);
  const selectedModel = String(model || cfg.wanxVideoModel || DEFAULT_WANX_VIDEO_MODEL).trim();
  const payload = {
    model: selectedModel,
    parameters: {
      resolution: VIDEO_RESOLUTION_720P,
      duration: duration || DEFAULT_IMAGE_DURATION_SECONDS,
      prompt_extend: true,
      watermark: false,
      audio: true,
    },
  };
  if (selectedModel === 'wan2.7-i2v') {
    payload.input = {
      prompt,
      media: [{ type: 'first_frame', url: imageUrl }],
    };
  } else {
    payload.input = { prompt, img_url: imageUrl };
  }
  const response = await fetch(`${baseUrl}/services/aigc/video-generation/video-synthesis`, {
    method: POST_METHOD,
    headers: {
      Authorization: `Bearer ${cfg.dashScopeApiKey}`,
      'Content-Type': JSON_CONTENT_TYPE,
      'X-DashScope-Async': 'enable',
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
    await wait(DEFAULT_POLL_INTERVAL_MS);
    const taskData = await getJson(`${baseUrl}/tasks/${taskId}`, cfg.dashScopeApiKey, timeoutMs);
    const status = String(taskData?.output?.task_status || '').toUpperCase();
    if (status === 'SUCCEEDED') {
      const videoUrl = taskData?.output?.video_url;
      if (!videoUrl) {
        throw new Error('视频任务成功但未返回 video_url');
      }
      const actualDuration = Number(taskData?.usage?.output_video_duration || taskData?.usage?.duration || duration || DEFAULT_IMAGE_DURATION_SECONDS);
      return { videoUrl, duration: actualDuration };
    }
    if (status === 'FAILED' || status === 'CANCELED') {
      throw new Error(String(taskData?.output?.message || taskData?.message || '视频任务失败'));
    }
  }
  throw new Error('视频生成任务超时');
}

async function generateSeedanceVideo(app, prompt, imageUrl, duration) {
  const cfg = getConfig(app);
  requireValue(cfg.seedanceApiKey, '镜头视频生成未配置：缺少 SEEDANCE_API_KEY');
  const baseUrl = normalizeBaseUrl(cfg.seedanceBaseUrl, ARK_BASE_URL);
  const timeoutMs = resolveTimeoutMs(cfg.seedanceRequestTimeoutSeconds, 300, DEFAULT_VIDEO_TIMEOUT_MS);
  const payload = {
    model: String(cfg.seedanceModel || DEFAULT_SEEDANCE_MODEL).trim(),
    content: [
      { type: 'text', text: prompt },
      { type: 'image_url', role: 'first_frame', image_url: { url: imageUrl } },
    ],
    duration: duration || DEFAULT_IMAGE_DURATION_SECONDS,
    resolution: VIDEO_RESOLUTION_480P,
    generate_audio: true,
  };
  const createData = await postJson(`${baseUrl}/contents/generations/tasks`, cfg.seedanceApiKey, payload, timeoutMs);
  const taskId = createData?.id;
  if (!taskId) {
    throw new Error('提交 Seedance 视频任务失败: 未返回任务 ID');
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await wait(DEFAULT_SEEDANCE_POLL_INTERVAL_MS);
    const taskData = await getJson(`${baseUrl}/contents/generations/tasks/${taskId}`, cfg.seedanceApiKey, timeoutMs);
    const status = String(taskData?.status || '').toLowerCase();
    if (SUCCESS_VIDEO_STATUSES.includes(status)) {
      const videoUrl = findFirstVideoUrl(taskData);
      if (!videoUrl) {
        throw new Error('Seedance 视频任务成功但未返回视频地址');
      }
      return { videoUrl, duration: Number(duration || DEFAULT_IMAGE_DURATION_SECONDS) };
    }
    if (FAILED_VIDEO_STATUSES.includes(status)) {
      throw new Error(String(findFirstMessage(taskData) || 'Seedance 视频任务失败'));
    }
  }
  throw new Error('Seedance 视频任务超时');
}

function findFirstMessage(value) {
  if (!value || typeof value !== 'object') {
    return '';
  }
  for (const key of HTTP_STATUS_KEYS) {
    if (typeof value[key] === 'string' && value[key].trim()) {
      return value[key].trim();
    }
  }
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const nested = findFirstMessage(item);
        if (nested) {
          return nested;
        }
      }
    } else if (child && typeof child === 'object') {
      const nested = findFirstMessage(child);
      if (nested) {
        return nested;
      }
    }
  }
  return '';
}

function findFirstVideoUrl(value) {
  if (!value || typeof value !== 'object') {
    return '';
  }
  for (const [ key, child ] of Object.entries(value)) {
    if (typeof child === 'string' && HTTP_PROTOCOL_PATTERN.test(child) && (key.toLowerCase().includes('video') || child.toLowerCase().endsWith(MP4_SUFFIX))) {
      return child;
    }
    if (Array.isArray(child)) {
      for (const item of child) {
        const nested = findFirstVideoUrl(item);
        if (nested) {
          return nested;
        }
      }
    } else if (child && typeof child === 'object') {
      const nested = findFirstVideoUrl(child);
      if (nested) {
        return nested;
      }
    }
  }
  return '';
}

async function createCharacterVoicePreview(app, character, customPrompt, customText) {
  const cfg = getConfig(app);
  const voicePrompt = String(customPrompt || '').trim() || buildCharacterVoicePrompt(character);
  const previewText = String(customText || '').trim() || buildCharacterVoiceReferenceText(character);
  return {
    designModel: String(cfg.dashScopeVoiceDesignModel || DEFAULT_DASHSCOPE_VOICE_DESIGN_MODEL).trim(),
    targetModel: String(cfg.dashScopeVoiceTargetModel || DEFAULT_DASHSCOPE_VOICE_TARGET_MODEL).trim(),
    voicePrompt,
    previewText,
    preferredVoiceName: preferredVoiceName(character),
  };
}

async function generateCharacterVoiceReference(app, character, customPrompt, customText) {
  const cfg = getConfig(app);
  requireValue(cfg.dashScopeApiKey, '角色主语音参考生成未配置：缺少 DASHSCOPE_API_KEY');
  const preview = await createCharacterVoicePreview(app, character, customPrompt, customText);
  const timeoutMs = resolveTimeoutMs(cfg.dashScopeVoiceRequestTimeoutSeconds, 120, DEFAULT_AUDIO_TIMEOUT_MS);
  const baseUrl = normalizeBaseUrl(cfg.dashScopeVoiceBaseUrl, DASHSCOPE_BASE_URL);
  const data = await postJson(`${baseUrl}/services/audio/tts/customization`, cfg.dashScopeApiKey, {
    model: preview.designModel,
    input: {
      action: 'create',
      target_model: preview.targetModel,
      voice_prompt: preview.voicePrompt,
      preview_text: preview.previewText,
      preferred_name: preview.preferredVoiceName,
      language: VOICE_LANGUAGE_ZH,
    },
    parameters: {
      sample_rate: 24000,
      response_format: VOICE_RESPONSE_FORMAT_WAV,
    },
  }, timeoutMs);

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
    extension: VOICE_RESPONSE_FORMAT_WAV,
  };
}

function preferredVoiceName(character) {
  const token = String(character?.name || 'character').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 12) || 'character';
  return `${token}_${character.id}`;
}

function buildCharacterVoicePrompt(character) {
  let prompt = '为漫剧角色设计一段稳定可复用的中文主语音。';
  if (String(character?.name || '').trim()) {
    prompt += ` 角色名：${String(character.name).trim()}。`;
  }
  if (String(character?.description || '').trim()) {
    prompt += ` 人设描述：${String(character.description).trim()}。`;
  }
  prompt += ' 声音要求：自然真人感，吐字清晰，适合剧情对白。 说话状态：克制、真实，不要主持腔，不要广告腔。';
  return prompt;
}

function buildCharacterVoiceReferenceText(character) {
  const name = String(character?.name || '').trim() || '我';
  return `我叫${name}。过去很多选择让我失去了方向，但这一次，我想亲手改写自己的命运。`;
}

module.exports = {
  generateWanxImage,
  generateWanxImageWithReferences,
  generateSeedreamImage,
  generateOpenAIImage,
  generateWanxVideo,
  generateSeedanceVideo,
  createCharacterVoicePreview,
  generateCharacterVoiceReference,
};
