'use strict';
// @ts-nocheck

module.exports = () => {
  return async function apiCors(ctx, next) {
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
