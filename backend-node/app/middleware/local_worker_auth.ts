'use strict';

const crypto = require('node:crypto');
const response = require('../lib/response');

export function validWorkerKey(expected: string, supplied: string) {
  if (expected.length < 32 || !supplied) return false;
  const hash = (value: string) => crypto.createHash('sha256').update(value).digest();
  return crypto.timingSafeEqual(hash(expected), hash(supplied));
}

module.exports = () => async (ctx: any, next: () => Promise<void>) => {
  if (!ctx.path.startsWith('/api/local-worker/')) return next();
  const cfg = ctx.app.config.storyboard;
  if (
    !validWorkerKey(cfg.localWorkerKey || '', ctx.get('authorization').replace(/^Bearer /, '')) ||
    !Number.isSafeInteger(cfg.localWorkerOwnerId) ||
    cfg.localWorkerOwnerId <= 0
  ) {
    ctx.status = 401;
    response.error(ctx, 'Invalid local worker credentials');
    return;
  }
  await next();
};
