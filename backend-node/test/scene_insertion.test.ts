import assert from 'node:assert/strict';
import * as SceneServiceNamespace from '../app/service/scene';

const SceneService: any =
  (SceneServiceNamespace as { default?: { prototype: object } }).default || SceneServiceNamespace;

describe('test/scene_insertion.test.ts', () => {
  it('shifts following scenes when creating at a requested position', async () => {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    const connection = {
      beginTransaction: async () => undefined,
      query: async (sql: string, params?: unknown[]) => {
        calls.push({ sql, params });
        return [[{ max_sort: 3 }]];
      },
      execute: async (sql: string, params?: unknown[]) => {
        calls.push({ sql, params });
        return sql.startsWith('UPDATE') ? [{ affectedRows: 2 }] : [{ insertId: 44 }];
      },
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
    };
    const service = Object.create(SceneService.prototype);
    Object.defineProperty(service, 'pool', {
      value: { getConnection: async () => connection },
    });
    service.findChapterById = async () => ({ id: 11, project_id: 19 });
    service.findById = async (id: number) => ({ id, sort_order: 2 });

    const created = await service.create(11, { title: '插入场景', sort_order: 2 });

    assert.deepEqual(created, { id: 44, sort_order: 2 });
    const shift = calls.find((call) => call.sql.startsWith('UPDATE scenes SET sort_order'));
    assert.deepEqual(shift?.params, [11, 2]);
    const insert = calls.find((call) => call.sql.startsWith('INSERT INTO scenes'));
    assert.equal(insert?.params?.[insert.params.length - 1], 2);
    const insertShape = insert?.sql.match(
      /INSERT INTO scenes\s*\(([\s\S]*?)\)\s*VALUES\s*\((.*?)\)/,
    );
    const columns = insertShape?.[1].split(',').map((item) => item.trim()) || [];
    const values = insertShape?.[2].split(',').map((item) => item.trim()) || [];
    assert.equal(
      values.length,
      columns.length,
      'scene INSERT columns and values must stay aligned',
    );
  });

  it('appends without shifting when no position is requested', async () => {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    const connection = {
      beginTransaction: async () => undefined,
      query: async () => [[{ max_sort: 3 }]],
      execute: async (sql: string, params?: unknown[]) => {
        calls.push({ sql, params });
        return [{ insertId: 45 }];
      },
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
    };
    const service = Object.create(SceneService.prototype);
    Object.defineProperty(service, 'pool', {
      value: { getConnection: async () => connection },
    });
    service.findChapterById = async () => ({ id: 11, project_id: 19 });
    service.findById = async (id: number) => ({ id, sort_order: 4 });

    await service.create(11, { title: '末尾场景' });

    assert.equal(
      calls.some((call) => call.sql.startsWith('UPDATE scenes SET sort_order')),
      false,
    );
    const insertParams = calls[0]?.params || [];
    assert.equal(insertParams[insertParams.length - 1], 4);
  });
});
