'use strict';

import { getNumberEnv } from '../../config/shared/env';

const { sweepOrphanedFiles } = require('../lib/media_reclamation');

/**
 * 每日巡检本地生成物目录，删除超过保留期且无任何数据行引用的孤儿文件。
 * 只处理本地盘；OSS 模式跳过（bucket 可能混有非本应用对象）。
 */
module.exports = {
  schedule: {
    cron: '0 0 3 * * *',
    type: 'worker',
  },
  async task(ctx: {
    app: {
      mysqlPool: {
        query: (sql: string, params?: unknown[]) => Promise<[any[], any[]]>;
      };
      logger: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
    };
  }) {
    try {
      const graceHours = getNumberEnv('RECLAIM_SWEEP_GRACE_HOURS', 24);
      const result = await sweepOrphanedFiles(ctx.app, ctx.app.mysqlPool, {
        olderThanMs: Math.max(1, graceHours) * 3600 * 1000,
        limit: getNumberEnv('RECLAIM_SWEEP_MAX_FILES', 500),
      });
      ctx.app.logger.info(
        `[reclaim] sweep done: scanned=${result.scanned} deleted=${result.deleted.length}`,
      );
    } catch (error) {
      ctx.app.logger.error(`[reclaim] sweep failed: ${(error as Error).message}`);
    }
  },
};
