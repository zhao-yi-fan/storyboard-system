'use strict';

const path = require('node:path');
const dotenv = require('dotenv');
require('ts-node').register({
  transpileOnly: true,
  skipProject: true,
  compilerOptions: {
    module: 'Node16',
    moduleResolution: 'Node16',
    esModuleInterop: true,
  },
});

const { buildServerConfig } = require('./sections/server.ts');
const { buildMysqlConfig } = require('./sections/mysql.ts');
const { buildStoryboardBaseConfig } = require('./sections/storyboard.ts');
const { buildDeepSeekConfig } = require('./providers/deepseek.ts');
const { buildDashScopeConfig } = require('./providers/dashscope.ts');
const { buildWanxConfig } = require('./providers/wanx.ts');
const { buildSeedanceConfig } = require('./providers/seedance.ts');
const { buildSeedreamConfig } = require('./providers/seedream.ts');
const { buildOpenAIConfig } = require('./providers/openai.ts');
const { buildOssConfig } = require('./providers/oss.ts');
const { FALLBACK_GO_ENV_PATH, LOCAL_ENV_PATH } = require('./shared/constants.ts');

const ENV_PATHS = [ LOCAL_ENV_PATH, FALLBACK_GO_ENV_PATH ];

for (const envPath of ENV_PATHS) {
  dotenv.config({ path: path.join(__dirname, '..', envPath) });
}

/**
 * @param {import('egg').EggAppInfo} appInfo
 */
module.exports = appInfo => {
  const config = {};

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
