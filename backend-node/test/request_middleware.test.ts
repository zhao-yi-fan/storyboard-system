import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { describe, it } from 'mocha';

const cjsRequire = createRequire(import.meta.url);
const apiCors = cjsRequire('../app/middleware/api_cors');
const rateLimit = cjsRequire('../app/middleware/rate_limit');
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

describe('test/request_middleware.test.ts rateLimit', () => {
  const billedRule = {
    name: 'billed',
    pattern: new RegExp('/api/scenes/\\d+/generate-video$'),
    windowSeconds: 600,
    maxRequests: 2,
    keyBy: 'user' as const,
  };

  function buildRateCtx(path: string, userId: number | string | null = 7) {
    return {
      path,
      ip: '10.0.0.1',
      state: userId === null ? {} : { currentUser: { id: userId } },
      status: 200 as number,
      body: undefined as unknown,
      headers: {} as Record<string, string>,
      set(name: string, value: string) {
        this.headers[name] = value;
      },
    };
  }

  it('lets unmatched paths through without counting', async () => {
    const middleware = rateLimit({ rules: [billedRule] });
    for (let index = 0; index < 5; index += 1) {
      const ctx = buildRateCtx('/api/projects');
      let nextCalled = false;
      await middleware(ctx, async () => {
        nextCalled = true;
      });
      assert.equal(nextCalled, true);
      assert.equal(ctx.status, 200);
    }
  });

  it('rejects with 429 and a retry hint once the window is exhausted', async () => {
    const middleware = rateLimit({ rules: [billedRule] });
    for (let index = 0; index < 2; index += 1) {
      const ctx = buildRateCtx('/api/scenes/21/generate-video');
      await middleware(ctx, async () => {});
      assert.equal(ctx.status, 200);
    }
    const rejected = buildRateCtx('/api/scenes/21/generate-video');
    let nextCalled = false;
    await middleware(rejected, async () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(rejected.status, 429);
    assert.equal((rejected.body as { code: number }).code, 0);
    assert.ok(Number(rejected.headers['Retry-After']) >= 1);
  });

  it('tracks different users in separate buckets', async () => {
    const middleware = rateLimit({ rules: [billedRule] });
    for (let index = 0; index < 2; index += 1) {
      await middleware(buildRateCtx('/api/scenes/21/generate-video', 7), async () => {});
    }
    const other = buildRateCtx('/api/scenes/21/generate-video', 8);
    await middleware(other, async () => {});
    assert.equal(other.status, 200);
  });

  it('fails open when a rule is malformed', async () => {
    const middleware = rateLimit({
      rules: [
        {
          name: 'broken',
          pattern: '/api/scenes/\\d+/generate-video$' as unknown as RegExp,
          windowSeconds: 600,
          maxRequests: 1,
          keyBy: 'user',
        },
      ],
    });
    const ctx = buildRateCtx('/api/scenes/21/generate-video');
    let nextCalled = false;
    await middleware(ctx, async () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(ctx.status, 200);
  });
});
