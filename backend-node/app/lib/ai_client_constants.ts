'use strict';

import {
  DEFAULT_REQUEST_TIMEOUT_SECONDS,
} from '../../config/shared/constants';
import {
  GENERATION_STATUS,
  VIDEO_ASPECT_RATIO,
  VIDEO_RESOLUTION,
} from './domain_constants';

const SECOND_IN_MS = 1000;

export const AI_HTTP = Object.freeze({
  JSON_CONTENT_TYPE: 'application/json',
  POST_METHOD: 'POST',
  DASHSCOPE_ASYNC_HEADER: 'X-DashScope-Async',
  DASHSCOPE_ASYNC_VALUE: 'enable',
  HTTP_PROTOCOL_PATTERN: /^https?:\/\//,
  MP4_SUFFIX: '.mp4',
  MESSAGE_KEYS: Object.freeze(['message', 'msg']),
});

export const AI_REQUEST_TIMEOUT = Object.freeze({
  SEEDREAM_SECONDS: DEFAULT_REQUEST_TIMEOUT_SECONDS.STANDARD,
  WANX_VIDEO_SECONDS: DEFAULT_REQUEST_TIMEOUT_SECONDS.LONG,
  SEEDANCE_SECONDS: DEFAULT_REQUEST_TIMEOUT_SECONDS.LONG,
  VOICE_SECONDS: DEFAULT_REQUEST_TIMEOUT_SECONDS.VOICE,
  STANDARD_INVALID_VALUE_MS: DEFAULT_REQUEST_TIMEOUT_SECONDS.LONG * SECOND_IN_MS,
  VOICE_INVALID_VALUE_MS: DEFAULT_REQUEST_TIMEOUT_SECONDS.VOICE * SECOND_IN_MS,
});

export const AI_POLL_INTERVAL_MS = Object.freeze({
  WANX_VIDEO: 15 * SECOND_IN_MS,
  SEEDANCE_VIDEO: 10 * SECOND_IN_MS,
});

export const AI_IMAGE_SIZE = Object.freeze({
  STORYBOARD_COVER: '2560x1440',
  CHARACTER_DESIGN_SHEET: '2304x1600',
});

export const AI_IMAGE_DEFAULT = Object.freeze({
  RESPONSE_FORMAT: 'url',
  WATERMARK: false,
});

export const AI_VIDEO_DEFAULT = Object.freeze({
  DURATION_SECONDS: 5,
  USE_FIRST_FRAME: true,
  WANX_RESOLUTION: '720P',
  SEEDANCE_RESOLUTION: VIDEO_RESOLUTION.SD,
  ASPECT_RATIO: VIDEO_ASPECT_RATIO.PORTRAIT,
  PROMPT_EXTEND: true,
  WATERMARK: false,
  GENERATE_AUDIO: true,
});

export const AI_VOICE_DEFAULT = Object.freeze({
  RESPONSE_FORMAT: 'wav',
  LANGUAGE: 'zh',
  SAMPLE_RATE: 24000,
  PREFERRED_NAME_MAX_LENGTH: 12,
  PREFERRED_NAME_FALLBACK: 'character',
  REFERENCE_TEXT: '今天风很轻，我们慢慢把事情说清楚。',
  DURATION_INSTRUCTION:
    '试听参考音频必须控制在3-5秒内，使用一句中文短句，语速自然，不要拉长停顿。',
});

export const AI_TASK_STATUS = Object.freeze({
  WANX_SUCCEEDED: 'SUCCEEDED',
  WANX_FAILED: 'FAILED',
  WANX_CANCELED: 'CANCELED',
  SUCCEEDED_ALIASES: Object.freeze([
    GENERATION_STATUS.SUCCEEDED,
    'success',
    'completed',
  ]),
  FAILED_ALIASES: Object.freeze([
    GENERATION_STATUS.FAILED,
    'error',
    'canceled',
    'cancelled',
  ]),
});

export const SEEDANCE_CONTENT = Object.freeze({
  TEXT: 'text',
  IMAGE_URL: 'image_url',
  AUDIO_URL: 'audio_url',
  FIRST_FRAME: 'first_frame',
  REFERENCE_IMAGE: 'reference_image',
  REFERENCE_AUDIO: 'reference_audio',
});

export const WANX_MEDIA_TYPE = Object.freeze({
  FIRST_FRAME: 'first_frame',
});
