'use strict';

type MiddlewareContext = {
  method: string;
  status: number;
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

    await next();
  };
};
