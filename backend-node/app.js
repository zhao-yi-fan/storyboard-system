'use strict';

const mysql = require('mysql2/promise');

class AppBootHook {
  constructor(app) {
    this.app = app;
  }

  async didLoad() {
    this.app.mysqlPool = mysql.createPool(this.app.config.mysql);
  }

  async beforeClose() {
    if (this.app.mysqlPool) {
      await this.app.mysqlPool.end();
    }
  }
}

module.exports = AppBootHook;
