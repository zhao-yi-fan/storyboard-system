'use strict';

import {
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_IMAGE_MODEL,
  DEFAULT_OPENAI_IMAGE_TIMEOUT_SECONDS,
} from '../shared/constants';
import { getNumberEnv, getStringEnv } from '../shared/env';

export function buildOpenAIConfig() {
  return {
    openAiApiKey: getStringEnv('OPENAI_API_KEY', ''),
    openAiImageBaseUrl: getStringEnv('OPENAI_IMAGE_BASE_URL', DEFAULT_OPENAI_BASE_URL),
    openAiImageModel: getStringEnv('OPENAI_IMAGE_MODEL', DEFAULT_OPENAI_IMAGE_MODEL),
    openAiImageTimeoutSeconds: getNumberEnv('OPENAI_IMAGE_TIMEOUT_SECONDS', DEFAULT_OPENAI_IMAGE_TIMEOUT_SECONDS),
  };
}
