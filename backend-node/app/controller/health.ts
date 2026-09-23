'use strict';

const Controller = require('egg').Controller;

const { resolveGeneratedAssetRoot } = require('../lib/generated_asset');

class HealthController extends Controller {
  /**
   * 存活探针：只确认进程可响应，不碰外部依赖。
   * @returns {Promise<void>} 直接写入 `{ status: "ok" }`。
   * @example
   * GET /api/health
   * // => { status: "ok" }
   */
  async index() {
    this.ctx.body = { status: 'ok' };
  }

  /**
   * 就绪探针：检查 MySQL 与生成物目录，DB 或磁盘异常返回 503。
   * 部署脚本的存活检查继续走浅接口，这里专供告警与人工巡检。
   * @returns {Promise<void>} 直接写入各依赖检查结果。
   * @example
   * GET /api/health/deep
   * // => { status: "ok", checks: { database: "ok", storage: "ok" } }
   */
  async deep() {
    const checks: Record<string, string> = { database: 'error', storage: 'error' };
    try {
      await this.app.mysqlPool.query('SELECT 1');
      checks.database = 'ok';
    } catch (error) {
      this.app.logger.error(`[health] database check failed: ${(error as Error).message}`);
    }
    try {
      // 与业务共用同一根目录解析（兼容 dist 运行），避免探针与实际读写两张皮。
      const fs = require('node:fs/promises');
      const dir = await resolveGeneratedAssetRoot(this.app);
      await fs.access(dir, fs.constants.W_OK);
      checks.storage = 'ok';
    } catch (error) {
      this.app.logger.error(`[health] storage check failed: ${(error as Error).message}`);
    }
    const healthy = checks.database === 'ok' && checks.storage === 'ok';
    this.ctx.status = healthy ? 200 : 503;
    this.ctx.body = { status: healthy ? 'ok' : 'error', checks };
  }
}

module.exports = HealthController;
