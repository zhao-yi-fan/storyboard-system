import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import type { Pool } from 'mysql2/promise';
import { SceneRepository } from '../app/repository/scene_repository';
import { StoryboardRepository } from '../app/repository/storyboard_repository';

type QueryCall = { sql: string; params: unknown[] };

function createPool(resultRows: unknown[]) {
  const calls: QueryCall[] = [];
  const pool = {
    async query(sql: string, params: unknown[]) {
      calls.push({ sql, params });
      return [resultRows, []];
    },
  } as unknown as Pool;
  return { pool, calls };
}

describe('extracted repositories', () => {
  it('keeps scene lookup scoped to non-deleted rows', async () => {
    const { pool, calls } = createPool([{ id: 3, chapter_id: 2, project_id: 1 }]);
    const repository = new SceneRepository(pool);

    const row = await repository.findById(3);

    assert.equal(row?.id, 3);
    assert.match(calls[0].sql, /FROM scenes/);
    assert.match(calls[0].sql, /deleted_at IS NULL/);
    assert.deepEqual(calls[0].params, [3]);
  });

  it('keeps storyboard list ordering and scene scope', async () => {
    const { pool, calls } = createPool([]);
    const repository = new StoryboardRepository(pool);

    await repository.findBySceneId(8);

    assert.match(calls[0].sql, /WHERE scene_id = \?/);
    assert.match(calls[0].sql, /ORDER BY sort_order ASC, id ASC/);
    assert.deepEqual(calls[0].params, [8]);
  });
});
