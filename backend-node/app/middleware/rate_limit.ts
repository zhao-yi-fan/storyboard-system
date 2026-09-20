'use strict';

const response = require('../lib/response');

const MAX_TRACKED_KEYS = 10000;
const RETRY_AFTER_HEADER = 'Retry-After';

type RateLimitRule = {
  name: string;
  pattern: RegExp;
  windowSeconds: number;
  maxRequests: number;
  keyBy: 'user' | 'ip';
};

type MiddlewareContext = {
  path: string;
  ip: string;
  state: { currentUser?: { id: number | string } };
  status: number;
  body?: unknown;
  set(name: string, value: string): void;
};

/**
 * 按路由表做滑动窗口限流。
 *
 * 单机内存桶（Egg 多 worker 下为近似值，但始终有界）；
 * 内部全程失败开路，计数器异常绝不挡正常请求。
 */
module.exports = (options: { rules?: RateLimitRule[] } = {}) => {
  const rules = Array.isArray(options.rules) ? options.rules : [];
  const hits = new Map<string, number[]>();

  function prune(now: number, windowMs: number, timestamps: number[]) {
    const cutoff = now - windowMs;
    while (timestamps.length && timestamps[0] <= cutoff) timestamps.shift();
  }

  function evictOverflow() {
    if (hits.size <= MAX_TRACKED_KEYS) return;
    const spill = hits.size - MAX_TRACKED_KEYS;
    const keys = hits.keys();
    for (let index = 0; index < spill; index += 1) {
      const next = keys.next();
      if (next.done) break;
      hits.delete(next.value);
    }
  }

  return async function rateLimit(ctx: MiddlewareContext, next: () => Promise<void>) {
    try {
      const rule = rules.find((item) => item.pattern.test(ctx.path));
      if (!rule || rule.maxRequests <= 0 || rule.windowSeconds <= 0) {
        await next();
        return;
      }
      const identity =
        rule.keyBy === 'user' && ctx.state.currentUser
          ? `user:${ctx.state.currentUser.id}`
          : `ip:${ctx.ip || 'unknown'}`;
      const bucketKey = `${rule.name}:${rule.pattern.source}:${identity}`;
      const now = Date.now();
      const windowMs = rule.windowSeconds * 1000;
      let timestamps = hits.get(bucketKey);
      if (!timestamps) {
        timestamps = [];
        hits.set(bucketKey, timestamps);
      }
      prune(now, windowMs, timestamps);
      if (timestamps.length >= rule.maxRequests) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((timestamps[0] + windowMs - now) / 1000),
        );
        ctx.status = 429;
        ctx.set(RETRY_AFTER_HEADER, String(retryAfterSeconds));
        response.error(ctx, '请求过于频繁，请稍后再试');
        return;
      }
      timestamps.push(now);
      evictOverflow();
    } catch {
      // 失败开路：计数器坏了也不挡请求。
    }
    await next();
  };
};
