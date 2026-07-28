'use strict';

import {
  DEFAULT_PROVIDER_BASE_URL,
  DEFAULT_PROVIDER_MODEL,
  DEFAULT_REQUEST_TIMEOUT_SECONDS,
} from '../shared/constants';
import { getNumberEnv, getStringEnv } from '../shared/env';

export function buildSeedreamConfig() {
  return {
    seedreamImageApiKey: getStringEnv('SEEDREAM_IMAGE_API_KEY', ''),
    seedreamImageBaseUrl: getStringEnv(
      'SEEDREAM_IMAGE_BASE_URL',
      DEFAULT_PROVIDER_BASE_URL.ARK,
    ),
    seedreamImageModel: getStringEnv(
      'SEEDREAM_IMAGE_MODEL',
      DEFAULT_PROVIDER_MODEL.SEEDREAM_IMAGE,
    ),
    seedreamImageTimeoutSeconds: getNumberEnv(
      'SEEDREAM_IMAGE_TIMEOUT_SECONDS',
      DEFAULT_REQUEST_TIMEOUT_SECONDS.STANDARD,
    ),
  };
}
