'use strict';

import {
  DEFAULT_PROVIDER_BASE_URL,
  DEFAULT_PROVIDER_MODEL,
  DEFAULT_REQUEST_TIMEOUT_SECONDS,
} from '../shared/constants';
import { getNumberEnv, getStringEnv } from '../shared/env';

export function buildDashScopeConfig() {
  return {
    dashScopeApiKey: getStringEnv('DASHSCOPE_API_KEY', ''),
    dashScopeVoiceBaseUrl: getStringEnv(
      'DASHSCOPE_VOICE_BASE_URL',
      DEFAULT_PROVIDER_BASE_URL.DASHSCOPE,
    ),
    dashScopeVoiceDesignModel: getStringEnv(
      'DASHSCOPE_VOICE_DESIGN_MODEL',
      DEFAULT_PROVIDER_MODEL.DASHSCOPE_VOICE_DESIGN,
    ),
    dashScopeVoiceTargetModel: getStringEnv(
      'DASHSCOPE_VOICE_TARGET_MODEL',
      DEFAULT_PROVIDER_MODEL.DASHSCOPE_VOICE_TARGET,
    ),
    dashScopeVoiceRequestTimeoutSeconds: getNumberEnv(
      'DASHSCOPE_VOICE_REQUEST_TIMEOUT_SECONDS',
      DEFAULT_REQUEST_TIMEOUT_SECONDS.VOICE,
    ),
  };
}
