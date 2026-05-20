'use strict';

import {
  DEFAULT_GENERATED_ASSET_BASE_PATH,
  DEFAULT_GENERATED_ASSET_DIR,
  DEFAULT_PUBLIC_APP_BASE_URL,
} from '../shared/constants';
import { getStringEnv } from '../shared/env';

export function buildStoryboardBaseConfig() {
  return {
    publicAppBaseUrl: getStringEnv('PUBLIC_APP_BASE_URL', DEFAULT_PUBLIC_APP_BASE_URL),
    generatedAssetDir: getStringEnv('GENERATED_ASSET_DIR', DEFAULT_GENERATED_ASSET_DIR),
    generatedAssetBasePath: getStringEnv('GENERATED_ASSET_BASE_PATH', DEFAULT_GENERATED_ASSET_BASE_PATH),
  };
}
