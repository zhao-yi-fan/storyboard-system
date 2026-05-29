'use strict';

export const LOCAL_ENV_PATH = '.env';
export const FALLBACK_GO_ENV_PATH = '../backend/.env';

export const DEFAULT_SERVER_PORT = 8083;
export const DEFAULT_SERVER_HOST = '0.0.0.0';

export const DEFAULT_DB_HOST = '127.0.0.1';
export const DEFAULT_DB_PORT = 3306;
export const DEFAULT_DB_USER = 'root';
export const DEFAULT_DB_NAME = 'storyboard';

export const DEFAULT_PUBLIC_APP_BASE_URL = '';
export const DEFAULT_GENERATED_ASSET_DIR = '../storage';
export const DEFAULT_GENERATED_ASSET_BASE_PATH = '/generated';
export const DEFAULT_CHARACTER_DESIGN_LAYOUT_REFERENCE_URL = '/generated/assets/1780043684268-1s8z3t9mzjn.png';

export const DEFAULT_DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1';
export const DEFAULT_ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';
export const DEFAULT_DASHSCOPE_VOICE_DESIGN_MODEL = 'qwen-voice-design';
export const DEFAULT_DASHSCOPE_VOICE_TARGET_MODEL = 'qwen3-tts-vd-2026-01-26';
export const DEFAULT_WANX_MODEL = 'wan2.7-image-pro';
export const DEFAULT_WANX_REFERENCE_MODEL = 'wan2.7-image-pro';
export const DEFAULT_WANX_VIDEO_MODEL = 'wan2.7-i2v';
export const DEFAULT_WANX_TEXT_VIDEO_MODEL = 'wan2.7-t2v-2026-04-25';
export const DEFAULT_SEEDANCE_MODEL = 'doubao-seedance-1-5-pro-251215';
export const DEFAULT_SEEDREAM_IMAGE_MODEL = 'doubao-seedream-4-5-251128';
export const DEFAULT_OPENAI_IMAGE_MODEL = 'gpt-image-2';

export const DEFAULT_TIMEOUT_SECONDS = 180;
export const DEFAULT_LONG_TIMEOUT_SECONDS = 300;
export const DEFAULT_DASHSCOPE_VOICE_TIMEOUT_SECONDS = 120;
export const DEFAULT_DEEPSEEK_TIMEOUT_SECONDS = DEFAULT_TIMEOUT_SECONDS;
export const DEFAULT_WANX_TIMEOUT_SECONDS = DEFAULT_LONG_TIMEOUT_SECONDS;
export const DEFAULT_WANX_VIDEO_TIMEOUT_SECONDS = DEFAULT_LONG_TIMEOUT_SECONDS;
export const DEFAULT_SEEDANCE_TIMEOUT_SECONDS = DEFAULT_LONG_TIMEOUT_SECONDS;
export const DEFAULT_SEEDREAM_TIMEOUT_SECONDS = DEFAULT_TIMEOUT_SECONDS;
export const DEFAULT_OPENAI_IMAGE_TIMEOUT_SECONDS = DEFAULT_TIMEOUT_SECONDS;
