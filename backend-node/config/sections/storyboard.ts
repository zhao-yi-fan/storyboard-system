'use strict';

import { DEFAULT_STORYBOARD_STORAGE } from '../shared/constants';
import { getStringEnv } from '../shared/env';

export function buildStoryboardBaseConfig() {
  return {
    publicAppBaseUrl: getStringEnv(
      'PUBLIC_APP_BASE_URL',
      DEFAULT_STORYBOARD_STORAGE.PUBLIC_APP_BASE_URL,
    ),
    generatedAssetDir: getStringEnv(
      'GENERATED_ASSET_DIR',
      DEFAULT_STORYBOARD_STORAGE.GENERATED_ASSET_DIR,
    ),
    generatedAssetBasePath: getStringEnv(
      'GENERATED_ASSET_BASE_PATH',
      DEFAULT_STORYBOARD_STORAGE.GENERATED_ASSET_BASE_PATH,
    ),
  };
}
