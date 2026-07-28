'use strict';

export const DEFAULT_ENV_PATH = Object.freeze({
  LOCAL: '.env',
  LEGACY_GO_FALLBACK: '../backend/.env',
});

export const DEFAULT_SERVER = Object.freeze({
  PORT: 8083,
  HOST: '0.0.0.0',
});

export const DEFAULT_DATABASE = Object.freeze({
  HOST: '127.0.0.1',
  PORT: 3306,
  USER: 'root',
  NAME: 'storyboard',
});

export const DEFAULT_STORYBOARD_STORAGE = Object.freeze({
  PUBLIC_APP_BASE_URL: '',
  GENERATED_ASSET_DIR: '../storage',
  GENERATED_ASSET_BASE_PATH: '/generated',
});

export const DEFAULT_AUTH = Object.freeze({
  COOKIE_NAME: 'storyboard_session',
  SESSION_TTL_DAYS: 14,
  BOOTSTRAP_DISPLAY_NAME: '创作者',
  BOOTSTRAP_ROLE_LABEL: '分镜工作室',
});

export const DEFAULT_PROVIDER_BASE_URL = Object.freeze({
  DASHSCOPE: 'https://dashscope.aliyuncs.com/api/v1',
  ARK: 'https://ark.cn-beijing.volces.com/api/v3',
  DEEPSEEK: 'https://api.deepseek.com',
});

export const DEFAULT_PROVIDER_MODEL = Object.freeze({
  DEEPSEEK: 'deepseek-v4-flash',
  DASHSCOPE_VOICE_DESIGN: 'qwen-voice-design',
  DASHSCOPE_VOICE_TARGET: 'qwen3-tts-vd-2026-01-26',
  WANX_VIDEO: 'wan2.7-i2v',
  WANX_TEXT_VIDEO: 'wan2.7-t2v-2026-04-25',
  SEEDANCE: 'doubao-seedance-2-0-260128',
  SEEDREAM_IMAGE: 'doubao-seedream-4-5-251128',
});

export const DEFAULT_REQUEST_TIMEOUT_SECONDS = Object.freeze({
  STANDARD: 180,
  LONG: 300,
  VOICE: 120,
});
