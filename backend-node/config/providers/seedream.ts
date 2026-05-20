'use strict';

import {
  DEFAULT_ARK_BASE_URL,
  DEFAULT_SEEDREAM_IMAGE_MODEL,
  DEFAULT_SEEDREAM_TIMEOUT_SECONDS,
} from '../shared/constants';
import { getNumberEnv, getStringEnv } from '../shared/env';

export function buildSeedreamConfig() {
  return {
    seedreamImageApiKey: getStringEnv('SEEDREAM_IMAGE_API_KEY', ''),
    seedreamImageBaseUrl: getStringEnv('SEEDREAM_IMAGE_BASE_URL', DEFAULT_ARK_BASE_URL),
    seedreamImageModel: getStringEnv('SEEDREAM_IMAGE_MODEL', DEFAULT_SEEDREAM_IMAGE_MODEL),
    seedreamImageTimeoutSeconds: getNumberEnv('SEEDREAM_IMAGE_TIMEOUT_SECONDS', DEFAULT_SEEDREAM_TIMEOUT_SECONDS),
  };
}
