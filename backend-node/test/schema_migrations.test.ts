import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { describe, it } from 'mocha';

const cjsRequire = createRequire(import.meta.url);
const { runSchemaSteps } = cjsRequire('../app/lib/schema_migrations');

function buildPool(applied: string[]) {
  const executed: Array<{ sql: string; params?: unknown[] }> = [];
  return {
    executed,
    async query(sql: string, params: unknown[] = []) {
      executed.push({ sql, params });
      if (sql.includes('FROM schema_migrations')) {
        const name = String(params[0] || '');
        return [applied.includes(name) ? [{ status: 'applied' }] : [], null];
      }
      return [[], null];
    },
    async execute(sql: string, params: unknown[] = []) {
      executed.push({ sql, params });
      return [{ affectedRows: 1 }, null];
    },
  };
}

describe('test/schema_migrations.test.ts', () => {
  it('skips steps already marked applied', async () => {
    const pool = buildPool(['auth']);
    let authRan = false;
    await runSchemaSteps(pool, [
      {
        name: 'auth',
        ensure: async () => {
          authRan = true;
        },
      },
      { name: 'asset_workspace', ensure: async () => undefined },
    ]);
    assert.equal(authRan, false);
    const records = pool.executed.filter((item) =>
      item.sql.includes('INTO schema_migrations'),
    );
    assert.equal(records.length, 1);
    assert.deepEqual(records[0].params?.[0], 'asset_workspace');
  });

  it('records applied steps and rethrows failures with a failed row', async () => {
    const pool = buildPool([]);
    await runSchemaSteps(pool, [{ name: 'auth', ensure: async () => undefined }]);
    const applied = pool.executed.find(
      (item) =>
        item.sql.includes('INTO schema_migrations') &&
        item.sql.includes("'applied'") &&
        item.params?.[0] === 'auth',
    );
    assert.ok(applied);

    const failingPool = buildPool([]);
    const failure = await runSchemaSteps(failingPool, [
      {
        name: 'scene_generation',
        ensure: async () => {
          throw new Error('boom');
        },
      },
    ]).then(
      () => null,
      (cause: unknown) => cause,
    );
    assert.ok(failure instanceof Error);
    assert.match(failure.message, /boom/);
    const failed = failingPool.executed.find(
      (item) =>
        item.sql.includes('INTO schema_migrations') &&
        item.sql.includes("'failed'") &&
        item.params?.[0] === 'scene_generation',
    );
    assert.ok(failed);
    assert.match(String(failed?.params?.[1] || ''), /boom/);
  });
});
