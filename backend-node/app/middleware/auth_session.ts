'use strict';

const response = require('../lib/response');

type MiddlewareContext = {
  path: string;
  cookies: {
    get: (name: string) => string | undefined;
    set: (name: string, value: string, options?: Record<string, unknown>) => void;
  };
  service: {
    auth: {
      getCurrentUserByToken: (token: string) => Promise<any>;
      touchSession: (sessionId: number) => Promise<void>;
    };
  };
  state: Record<string, unknown>;
};

module.exports = (options: { publicPaths?: string[]; sessionCookieName?: string }) => {
  const publicPaths = options.publicPaths || [];
  const sessionCookieName = options.sessionCookieName || 'storyboard_session';

  return async function authSession(ctx: MiddlewareContext, next: () => Promise<void>) {
    if (!ctx.path.startsWith('/api/')) {
      await next();
      return;
    }

    if (publicPaths.includes(ctx.path)) {
      await next();
      return;
    }

    const sessionToken = ctx.cookies.get(sessionCookieName);
    if (!sessionToken) {
      response.error(ctx, '请先登录');
      return;
    }

    const currentSession = await ctx.service.auth.getCurrentUserByToken(sessionToken);
    if (!currentSession) {
      ctx.cookies.set(sessionCookieName, '', {
        httpOnly: true,
        overwrite: true,
        expires: new Date(0),
      });
      response.error(ctx, '请先登录');
      return;
    }

    ctx.state.currentUser = currentSession.user;
    ctx.state.currentSession = currentSession.session;
    await ctx.service.auth.touchSession(currentSession.session.id);
    await next();
  };
};
