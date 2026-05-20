'use strict';

import {
  DEFAULT_DEEPSEEK_BASE_URL,
  DEFAULT_DEEPSEEK_MODEL,
  DEFAULT_DEEPSEEK_TIMEOUT_SECONDS,
} from '../shared/constants';
import { getNumberEnv, getStringEnv } from '../shared/env';

export function buildDeepSeekConfig() {
  return {
    deepSeekApiKey: getStringEnv('DEEPSEEK_API_KEY', ''),
    deepSeekBaseUrl: getStringEnv('DEEPSEEK_BASE_URL', DEFAULT_DEEPSEEK_BASE_URL),
    deepSeekModel: getStringEnv('DEEPSEEK_MODEL', DEFAULT_DEEPSEEK_MODEL),
    deepSeekRequestTimeoutSeconds: getNumberEnv('DEEPSEEK_REQUEST_TIMEOUT_SECONDS', DEFAULT_DEEPSEEK_TIMEOUT_SECONDS),
  };
}
