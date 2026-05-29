'use strict';

const Controller = require('egg').Controller;

class HealthController extends Controller {
  /**
   * 返回基础健康检查结果。
   * @returns {Promise<void>} 直接写入 `{ status: "ok" }`。
   * @example
   * GET /api/health
   * // => { status: "ok" }
   */
  async index() {
    this.ctx.body = { status: 'ok' };
  }
}

module.exports = HealthController;
