'use strict';

import {
  DEFAULT_PROVIDER_BASE_URL,
  DEFAULT_PROVIDER_MODEL,
  DEFAULT_REQUEST_TIMEOUT_SECONDS,
} from '../shared/constants';
import { getNumberEnv, getStringEnv } from '../shared/env';

export function buildDeepSeekConfig() {
  return {
    deepSeekApiKey: getStringEnv('DEEPSEEK_API_KEY', ''),
    deepSeekBaseUrl: getStringEnv('DEEPSEEK_BASE_URL', DEFAULT_PROVIDER_BASE_URL.DEEPSEEK),
    deepSeekModel: getStringEnv('DEEPSEEK_MODEL', DEFAULT_PROVIDER_MODEL.DEEPSEEK),
    deepSeekRequestTimeoutSeconds: getNumberEnv(
      'DEEPSEEK_REQUEST_TIMEOUT_SECONDS',
      DEFAULT_REQUEST_TIMEOUT_SECONDS.STANDARD,
    ),
  };
}
