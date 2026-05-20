'use strict';

import {
  DEFAULT_ARK_BASE_URL,
  DEFAULT_SEEDANCE_MODEL,
  DEFAULT_SEEDANCE_TIMEOUT_SECONDS,
} from '../shared/constants';
import { getNumberEnv, getStringEnv } from '../shared/env';

export function buildSeedanceConfig() {
  return {
    seedanceApiKey: getStringEnv('SEEDANCE_API_KEY', ''),
    seedanceBaseUrl: getStringEnv('SEEDANCE_BASE_URL', DEFAULT_ARK_BASE_URL),
    seedanceModel: getStringEnv('SEEDANCE_MODEL', DEFAULT_SEEDANCE_MODEL),
    seedanceRequestTimeoutSeconds: getNumberEnv('SEEDANCE_REQUEST_TIMEOUT_SECONDS', DEFAULT_SEEDANCE_TIMEOUT_SECONDS),
  };
}
