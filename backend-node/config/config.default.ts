'use strict';

import path from 'node:path';
import dotenv from 'dotenv';
import { buildServerConfig } from './sections/server';
import { buildMysqlConfig } from './sections/mysql';
import { buildStoryboardBaseConfig } from './sections/storyboard';
import { buildDeepSeekConfig } from './providers/deepseek';
import { buildDashScopeConfig } from './providers/dashscope';
import { buildWanxConfig } from './providers/wanx';
import { buildSeedanceConfig } from './providers/seedance';
import { buildSeedreamConfig } from './providers/seedream';
import { buildOpenAIConfig } from './providers/openai';
import { buildOssConfig } from './providers/oss';
import { FALLBACK_GO_ENV_PATH, LOCAL_ENV_PATH } from './shared/constants';

const ENV_PATHS = [ LOCAL_ENV_PATH, FALLBACK_GO_ENV_PATH ];
const DIST_DIR_NAME = 'dist';

function resolveBackendNodeRootDir(): string {
  const candidate = path.resolve(__dirname, '..');
  if (path.basename(candidate) === DIST_DIR_NAME) {
    return path.resolve(candidate, '..');
  }
  return candidate;
}

const backendNodeRootDir = resolveBackendNodeRootDir();

for (const envPath of ENV_PATHS) {
  dotenv.config({ path: path.join(backendNodeRootDir, envPath) });
}

module.exports = (appInfo: { name: string }) => {
  const config: Record<string, unknown> = {};

  config.keys = `${appInfo.name}-migration-key`;

  config.middleware = [ 'apiCors' ];
  config.cluster = { listen: buildServerConfig() };

  config.bodyParser = {
    jsonLimit: '10mb',
    formLimit: '10mb',
  };

  config.mysql = buildMysqlConfig();
  config.storyboard = {
    ...buildStoryboardBaseConfig(),
    ...buildDeepSeekConfig(),
    ...buildDashScopeConfig(),
    ...buildWanxConfig(),
    ...buildSeedanceConfig(),
    ...buildSeedreamConfig(),
    ...buildOpenAIConfig(),
    ...buildOssConfig(),
  };

  return config;
};
