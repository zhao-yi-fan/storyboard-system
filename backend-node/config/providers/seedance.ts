'use strict';

import {
  DEFAULT_PROVIDER_BASE_URL,
  DEFAULT_PROVIDER_MODEL,
  DEFAULT_REQUEST_TIMEOUT_SECONDS,
} from '../shared/constants';
import { getNumberEnv, getStringEnv } from '../shared/env';

export function buildSeedanceConfig() {
  return {
    seedanceApiKey: getStringEnv('SEEDANCE_API_KEY', getStringEnv('ARK_API_KEY', '')),
    seedanceBaseUrl: getStringEnv('SEEDANCE_BASE_URL', DEFAULT_PROVIDER_BASE_URL.ARK),
    seedanceModel: getStringEnv('SEEDANCE_MODEL', DEFAULT_PROVIDER_MODEL.SEEDANCE),
    seedanceRequestTimeoutSeconds: getNumberEnv(
      'SEEDANCE_REQUEST_TIMEOUT_SECONDS',
      DEFAULT_REQUEST_TIMEOUT_SECONDS.LONG,
    ),
  };
}
