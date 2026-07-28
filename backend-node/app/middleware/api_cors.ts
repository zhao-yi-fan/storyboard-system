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

module.exports = (): ((ctx: MiddlewareContext, next: () => Promise<void>) => Promise<void>) => {
  return async function apiCors(ctx: MiddlewareContext, next: () => Promise<void>) {
    const origin = ctx.get('Origin');
    ctx.set('Access-Control-Allow-Origin', origin || '*');
    ctx.set('Access-Control-Allow-Credentials', 'true');
    ctx.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    ctx.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    ctx.set('Vary', 'Origin');

    if (ctx.method === 'OPTIONS') {
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
