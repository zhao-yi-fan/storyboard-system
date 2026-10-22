import assert from 'node:assert/strict';

import { describe, it } from 'mocha';

import { ensurePersonalImageSchema } from '../app/lib/personal_image_schema';

describe('personal image schema', () => {
  it('adds the nullable source column once and releases each connection', async () => {
    let exists = false;
    let alters = 0;
    let releases = 0;
    let unlocks = 0;
    const pool = {
      async getConnection() {
        return {
          async query(sql: string) {
            if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }], []];
            if (sql.includes('information_schema')) return [exists ? [{ present: 1 }] : [], []];
            if (sql.includes('ALTER TABLE')) {
              exists = true;
              alters++;
              assert.match(sql, /BIGINT UNSIGNED NULL/);
            }
            if (sql.includes('RELEASE_LOCK')) unlocks++;
            return [[], []];
          },
          release() {
            releases++;
          },
        };
      },
    };
    await ensurePersonalImageSchema(pool as never);
    await ensurePersonalImageSchema(pool as never);
    assert.equal(alters, 1);
    assert.equal(releases, 2);
    assert.equal(unlocks, 2);
  });
});
