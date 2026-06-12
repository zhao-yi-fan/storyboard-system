// @ts-nocheck
'use strict';

const mysql = require('mysql2/promise');
const { ensureAuthSchema, ensureBootstrapAuthUser } = require('./app/lib/auth_schema');

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
  constructor(app) {
    this.app = app;
  }

  async didLoad() {
    this.app.mysqlPool = mysql.createPool(this.app.config.mysql);
    try {
      await ensureAuthSchema(this.app.mysqlPool);
      await ensureBootstrapAuthUser(this.app.mysqlPool, this.app.config.auth || {});
    } catch (error) {
      if (!isUnitTestEnvironment()) {
        throw error;
      }
      this.app.coreLogger.warn('[auth] skip auth schema bootstrap in unittest: %s', error?.message || error);
    }
  }

  async beforeClose() {
    if (this.app.mysqlPool) {
      await this.app.mysqlPool.end();
    }
  }
}

module.exports = AppBootHook;
