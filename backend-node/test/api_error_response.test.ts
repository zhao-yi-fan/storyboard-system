import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'mocha';

const cjsRequire = createRequire(import.meta.url);
const createApiCors = cjsRequire('../app/middleware/api_cors');

describe('test/api_error_response.test.ts', () => {
  it('returns the unified JSON response when downstream middleware throws', async () => {
    let emittedError: unknown = null;
    const ctx = {
      method: 'POST',
      status: 500,
      body: null,
      app: {
        emit: (_event: string, error: unknown) => {
          emittedError = error;
        },
      },
      get: () => '',
      set: () => undefined,
    };

    await createApiCors()(ctx, async () => {
      throw new Error('DeepSeek connection failed');
    });

    assert.equal(ctx.status, 200);
    assert.deepStrictEqual(ctx.body, {
      code: 0,
      data: null,
      message: 'DeepSeek connection failed',
    });
    assert.ok(emittedError instanceof Error);
  });
});
