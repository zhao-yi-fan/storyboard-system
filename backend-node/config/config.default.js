'use strict';

const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'backend', '.env') });

/**
 * @param {import('egg').EggAppInfo} appInfo
 */
module.exports = appInfo => {
  const config = {};

  config.keys = `${appInfo.name}-migration-key`;

  config.middleware = [ 'apiCors' ];

  config.cluster = {
    listen: {
      port: Number(process.env.SERVER_PORT || 8083),
      hostname: process.env.SERVER_HOST || '0.0.0.0',
    },
  };

  config.bodyParser = {
    jsonLimit: '10mb',
    formLimit: '10mb',
  };

  config.mysql = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'storyboard',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true,
    timezone: 'Z',
  };

  config.storyboard = {
    publicAppBaseUrl: process.env.PUBLIC_APP_BASE_URL || '',
    generatedAssetDir: process.env.GENERATED_ASSET_DIR || '../storage',
    generatedAssetBasePath: process.env.GENERATED_ASSET_BASE_PATH || '/generated',
    deepSeekApiKey: process.env.DEEPSEEK_API_KEY || '',
    deepSeekBaseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    deepSeekModel: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
    deepSeekRequestTimeoutSeconds: Number(process.env.DEEPSEEK_REQUEST_TIMEOUT_SECONDS || 180),
    dashScopeApiKey: process.env.DASHSCOPE_API_KEY || '',
    dashScopeVoiceBaseUrl: process.env.DASHSCOPE_VOICE_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1',
    dashScopeVoiceDesignModel: process.env.DASHSCOPE_VOICE_DESIGN_MODEL || 'qwen-voice-design',
    dashScopeVoiceTargetModel: process.env.DASHSCOPE_VOICE_TARGET_MODEL || 'qwen3-tts-vd-2026-01-26',
    dashScopeVoiceRequestTimeoutSeconds: Number(process.env.DASHSCOPE_VOICE_REQUEST_TIMEOUT_SECONDS || 120),
    wanxBaseUrl: process.env.WANX_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1',
    wanxModel: process.env.WANX_MODEL || 'wanx2.0-t2i-turbo',
    wanxReferenceModel: process.env.WANX_REFERENCE_MODEL || 'wan2.7-image-pro',
    wanxRequestTimeoutSeconds: Number(process.env.WANX_REQUEST_TIMEOUT_SECONDS || 300),
    wanxVideoBaseUrl: process.env.WANX_VIDEO_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1',
    wanxVideoModel: process.env.WANX_VIDEO_MODEL || 'wan2.7-i2v',
    wanxVideoRequestTimeoutSeconds: Number(process.env.WANX_VIDEO_REQUEST_TIMEOUT_SECONDS || 300),
    seedanceApiKey: process.env.SEEDANCE_API_KEY || '',
    seedanceBaseUrl: process.env.SEEDANCE_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
    seedanceModel: process.env.SEEDANCE_MODEL || 'doubao-seedance-1-5-pro-251215',
    seedanceRequestTimeoutSeconds: Number(process.env.SEEDANCE_REQUEST_TIMEOUT_SECONDS || 300),
    seedreamImageApiKey: process.env.SEEDREAM_IMAGE_API_KEY || '',
    seedreamImageBaseUrl: process.env.SEEDREAM_IMAGE_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
    seedreamImageModel: process.env.SEEDREAM_IMAGE_MODEL || 'doubao-seedream-4-5-251128',
    seedreamImageTimeoutSeconds: Number(process.env.SEEDREAM_IMAGE_TIMEOUT_SECONDS || 180),
    openAiApiKey: process.env.OPENAI_API_KEY || '',
    openAiImageBaseUrl: process.env.OPENAI_IMAGE_BASE_URL || 'https://api.openai.com/v1',
    openAiImageModel: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2',
    openAiImageTimeoutSeconds: Number(process.env.OPENAI_IMAGE_TIMEOUT_SECONDS || 180),
    aliyunOssEndpoint: process.env.ALIYUN_OSS_ENDPOINT || '',
    aliyunOssPublicEndpoint: process.env.ALIYUN_OSS_PUBLIC_ENDPOINT || '',
    aliyunOssAccessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID || '',
    aliyunOssAccessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET || '',
    aliyunOssBucket: process.env.ALIYUN_OSS_BUCKET || '',
  };

  return config;
};
