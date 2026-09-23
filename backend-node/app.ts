'use strict';

import type { AuthConfig } from './app/lib/auth_schema';
import type { SqlExecutor, StoryboardAppConfig } from './app/lib/entity';

const mysql = require('mysql2/promise');
const { ensureAuthSchema, ensureBootstrapAuthUser } = require('./app/lib/auth_schema');
const { ensureShotDirectionAnalysisSchema } = require('./app/lib/shot_direction_schema');
const { ensureAssetWorkspaceSchema } = require('./app/lib/asset_workspace_schema');
const { ensureSceneGenerationSchema } = require('./app/lib/scene_generation_schema');
const {
  ensureSchemaMigrationsTable,
  runSchemaSteps,
} = require('./app/lib/schema_migrations');

function isUnitTestEnvironment() {
  return (
    process.env.NODE_ENV === 'unittest' ||
    process.env.NODE_ENV === 'test' ||
    process.env.EGG_SERVER_ENV === 'unittest' ||
    process.env.EGG_SERVER_ENV === 'test' ||
    process.env.npm_lifecycle_event === 'test'
  );
}

class AppBootHook {
  app: {
    config: {
      mysql: unknown;
      auth?: AuthConfig;
      storyboard: StoryboardAppConfig;
      [key: string]: unknown;
    };
    mysqlPool?: SqlExecutor;
    coreLogger: {
      warn: (...args: unknown[]) => void;
    };
  };

  constructor(app: AppBootHook['app']) {
    this.app = app;
  }

  async didLoad() {
    const pool: SqlExecutor = mysql.createPool(this.app.config.mysql);
    this.app.mysqlPool = pool;
    try {
      await ensureSchemaMigrationsTable(pool);
      await runSchemaSteps(pool, [
        { name: 'auth', ensure: ensureAuthSchema },
        { name: 'asset_workspace', ensure: ensureAssetWorkspaceSchema },
        { name: 'scene_generation', ensure: ensureSceneGenerationSchema },
        { name: 'shot_direction', ensure: ensureShotDirectionAnalysisSchema },
      ]);
      await ensureBootstrapAuthUser(pool, this.app.config.auth || {});
    } catch (error) {
      if (!isUnitTestEnvironment()) {
        throw error;
      }
      this.app.coreLogger.warn(
        '[auth] skip auth schema bootstrap in unittest: %s',
        error instanceof Error ? error.message : error,
      );
    }
  }

  async beforeClose() {
    if (this.app.mysqlPool) {
      await this.app.mysqlPool.end();
    }
  }
}

module.exports = AppBootHook;
