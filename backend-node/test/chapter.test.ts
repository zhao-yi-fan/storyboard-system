import assert from 'node:assert/strict';

import { describe, it } from 'mocha';

import * as ChapterServiceNamespace from '../app/service/chapter';

const ChapterService: any =
  (ChapterServiceNamespace as { default?: { prototype: object } }).default ||
  ChapterServiceNamespace;

const CHAPTER_ROW = {
  id: 11,
  project_id: 19,
  title: '第1章',
  summary: '',
  sort_order: 1,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function makeService(queryImpl: (sql: string, params?: unknown[]) => Promise<unknown[][]>) {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const pool = {
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return queryImpl(sql, params);
    },
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [{ insertId: 12 }];
    },
  };
  const service = Object.create(ChapterService.prototype);
  Object.defineProperty(service, 'pool', { value: pool });
  return { service, calls };
}

describe('test/chapter.test.ts', () => {
  it('creates a chapter appended after max sort order', async () => {
    const { service, calls } = makeService(async (sql: string) => {
      if (sql.includes('FROM projects')) return [[{ id: 19 }]];
      if (sql.includes('MAX(sort_order)')) return [[{ max_sort: 3 }]];
      return [[CHAPTER_ROW]];
    });
    const created = await service.create(19, { title: '第2章' });
    assert.equal(created.title, '第1章');
    const insert = calls.find((call) => call.sql.startsWith('INSERT INTO chapters'));
    assert.deepEqual(insert?.params, [19, '第2章', '', 4]);
  });

  it('rejects empty titles', async () => {
    const { service } = makeService(async () => [[{ id: 19 }]]);
    await assert.rejects(service.create(19, { title: '  ' }), /title is required/);
  });

  it('returns null for missing chapters', async () => {
    const { service } = makeService(async () => [[]]);
    assert.equal(await service.findById(999), null);
  });

  it('soft-deletes with a delete marker', async () => {
    const executed: string[] = [];
    const service = Object.create(ChapterService.prototype);
    Object.defineProperty(service, 'pool', {
      value: {
        query: async () => [[CHAPTER_ROW]],
        execute: async (sql: string) => {
          executed.push(sql);
          return [{ affectedRows: 1 }];
        },
      },
    });
    await service.softDelete(11);
    assert.ok(executed.some((sql) => sql.includes('deleted_at')));
  });
});
