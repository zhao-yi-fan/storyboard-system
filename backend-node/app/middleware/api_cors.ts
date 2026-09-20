'use strict';

const response = require('../lib/response');

type MiddlewareContext = {
  method: string;
  status: number;
  app: {
    emit(event: string, error: unknown, ctx: MiddlewareContext): void;
  };
  body?: unknown;
  get(name: string): string;
  set(name: string, value: string): void;
};

module.exports = (
  options: { allowedOrigins?: string[] } = {},
): ((ctx: MiddlewareContext, next: () => Promise<void>) => Promise<void>) => {
  const allowedOrigins = Array.isArray(options.allowedOrigins)
    ? options.allowedOrigins.filter(Boolean)
    : [];
  return async function apiCors(ctx: MiddlewareContext, next: () => Promise<void>) {
    const origin = ctx.get('Origin');
    // 无 Origin 的是非浏览器请求（curl、探针、服务端调用），直接放行。
    // 有 Origin 的只放白名单：不在名单不写 CORS 头，浏览器会拦截。
    const allowed = !origin || allowedOrigins.includes(origin);
    if (allowed && origin) {
      ctx.set('Access-Control-Allow-Origin', origin);
      ctx.set('Access-Control-Allow-Credentials', 'true');
      ctx.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      ctx.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      ctx.set('Vary', 'Origin');
    }

    if (ctx.method === 'OPTIONS') {
      if (!allowed) {
        ctx.status = 403;
        response.error(ctx, 'origin not allowed');
        return;
      }
      ctx.status = 204;
      return;
    }

    try {
      await next();
    } catch (error) {
      ctx.app.emit('error', error, ctx);
      ctx.status = 200;
      response.error(
        ctx,
        error instanceof Error && error.message ? error.message : '服务器内部错误',
      );
    }
  };
};
