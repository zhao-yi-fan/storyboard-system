'use strict';

import {
  DEFAULT_DASHSCOPE_BASE_URL,
  DEFAULT_DASHSCOPE_VOICE_DESIGN_MODEL,
  DEFAULT_DASHSCOPE_VOICE_TARGET_MODEL,
  DEFAULT_DASHSCOPE_VOICE_TIMEOUT_SECONDS,
} from '../shared/constants';
import { getNumberEnv, getStringEnv } from '../shared/env';

export function buildDashScopeConfig() {
  return {
    dashScopeApiKey: getStringEnv('DASHSCOPE_API_KEY', ''),
    dashScopeVoiceBaseUrl: getStringEnv('DASHSCOPE_VOICE_BASE_URL', DEFAULT_DASHSCOPE_BASE_URL),
    dashScopeVoiceDesignModel: getStringEnv('DASHSCOPE_VOICE_DESIGN_MODEL', DEFAULT_DASHSCOPE_VOICE_DESIGN_MODEL),
    dashScopeVoiceTargetModel: getStringEnv('DASHSCOPE_VOICE_TARGET_MODEL', DEFAULT_DASHSCOPE_VOICE_TARGET_MODEL),
    dashScopeVoiceRequestTimeoutSeconds: getNumberEnv('DASHSCOPE_VOICE_REQUEST_TIMEOUT_SECONDS', DEFAULT_DASHSCOPE_VOICE_TIMEOUT_SECONDS),
  };
}
