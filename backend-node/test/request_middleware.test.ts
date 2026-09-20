import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { describe, it } from 'mocha';

const cjsRequire = createRequire(import.meta.url);
const apiCors = cjsRequire('../app/middleware/api_cors');
const requestId = cjsRequire('../app/middleware/request_id');

function buildCorsCtx(origin?: string, method = 'GET') {
  const headers: Record<string, string> = {};
  return {
    method,
    status: 200 as number,
    body: undefined as unknown,
    app: { emit: () => {} },
    get: (name: string) => (name === 'Origin' ? (origin as string) : ''),
    set: (name: string, value: string) => {
      headers[name] = value;
    },
    headers,
  };
}

describe('test/request_middleware.test.ts', () => {
  it('reflects only allowlisted origins with credentials', async () => {
    const middleware = apiCors({ allowedOrigins: ['https://studio.example.com'] });
    const ctx = buildCorsCtx('https://studio.example.com');
    await middleware(ctx, async () => {});
    assert.equal(ctx.headers['Access-Control-Allow-Origin'], 'https://studio.example.com');
    assert.equal(ctx.headers['Access-Control-Allow-Credentials'], 'true');
  });

  it('writes no CORS headers for origins outside the allowlist', async () => {
    const middleware = apiCors({ allowedOrigins: ['https://studio.example.com'] });
    let nextCalled = false;
    const ctx = buildCorsCtx('https://evil.example.com');
    await middleware(ctx, async () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(ctx.headers['Access-Control-Allow-Origin'], undefined);
  });

  it('rejects preflight requests from origins outside the allowlist', async () => {
    const middleware = apiCors({ allowedOrigins: ['https://studio.example.com'] });
    const ctx = buildCorsCtx('https://evil.example.com', 'OPTIONS');
    await middleware(ctx, async () => {
      throw new Error('next should not run');
    });
    assert.equal(ctx.status, 403);
  });

  it('lets requests without an origin through (curl, probes, server-side calls)', async () => {
    const middleware = apiCors({ allowedOrigins: [] });
    let nextCalled = false;
    const ctx = buildCorsCtx(undefined);
    await middleware(ctx, async () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  });

  it('assigns a request id, echoes it, and keeps a well-formed incoming one', async () => {
    const middleware = requestId();
    const fresh: { state: Record<string, unknown>; headers: Record<string, string> } = {
      state: {},
      headers: {},
    };
    await middleware(
      {
        state: fresh.state,
        get: () => '',
        set: (name: string, value: string) => {
          fresh.headers[name] = value;
        },
      },
      async () => {},
    );
    assert.match(String(fresh.state.requestId), /^[0-9a-f-]{36}$/);
    assert.equal(fresh.headers['X-Request-Id'], fresh.state.requestId);

    const kept: { state: Record<string, unknown> } = { state: {} };
    await middleware(
      {
        state: kept.state,
        get: () => 'req-123',
        set: () => {},
      },
      async () => {},
    );
    assert.equal(kept.state.requestId, 'req-123');
  });

  it('replaces a malformed incoming request id', async () => {
    const middleware = requestId();
    const ctx: { state: Record<string, unknown> } = { state: {} };
    await middleware(
      {
        state: ctx.state,
        get: () => 'has spaces and 中文',
        set: () => {},
      },
      async () => {},
    );
    assert.notEqual(ctx.state.requestId, 'has spaces and 中文');
  });
});
