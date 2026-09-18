import assert from 'node:assert/strict';

import { describe, it } from 'mocha';

import * as ScriptImportServiceNamespace from '../app/service/script_import';

const ScriptImportService: any =
  (ScriptImportServiceNamespace as { default?: { prototype: object } }).default ||
  ScriptImportServiceNamespace;

const PARSED_DOCUMENT = {
  characters: [{ name: '李明', description: '少年', appearance: '', tags: [] }],
  chapters: [
    {
      title: '第1章',
      summary: '开场',
      order: 1,
      scenes: [
        {
          title: '便利店门口',
          summary: '深夜的便利店',
          description: '深夜的便利店',
          location: '便利店门口',
          time_of_day: '夜',
          timeOfDay: '夜',
          order: 1,
          props: [{ name: '雨伞', description: '红伞' }],
          storyboards: [
            {
              visual_description: '李明抬头',
              notes: '',
              dialogue: '',
              shot_type: '近景',
              mood: '',
              camera_angle: '',
              duration_seconds: 5,
              characters: ['李明'],
            },
          ],
        },
      ],
    },
  ],
};

function makeService() {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  let nextId = 100;
  const conn = {
    beginTransaction: async () => undefined,
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [[]];
    },
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      nextId += 1;
      return [{ insertId: nextId, affectedRows: 1 }];
    },
    commit: async () => {
      calls.push({ sql: 'COMMIT' });
    },
    rollback: async () => {
      calls.push({ sql: 'ROLLBACK' });
    },
    release: () => undefined,
  };
  const parseScript = async (_config: unknown, text: string) => {
    calls.push({ sql: 'PARSE', params: [text] });
    return { cleaned: String(text).trim(), document: PARSED_DOCUMENT };
  };
  const service = Object.create(ScriptImportService.prototype);
  Object.defineProperty(service, 'pool', {
    value: { getConnection: async () => conn },
    configurable: true,
  });
  Object.defineProperty(service, 'app', {
    value: { config: { storyboard: {} } },
    configurable: true,
  });
  Object.defineProperty(service, 'ctx', {
    value: { service: { project: { findById: async () => ({ id: 19 }) } } },
    configurable: true,
  });
  return { service, calls, parseScript };
}

describe('test/script_import.test.ts', () => {
  it('imports chapters, scenes, shots and characters end to end', async () => {
    const { service, calls, parseScript } = makeService();
    const result = await service.parseAndImport(19, '李明推开便利店门。', parseScript);

    assert.deepEqual(result, {
      project_id: 19,
      chapter_count: 1,
      scene_count: 1,
      storyboard_count: 1,
      character_count: 1,
    });
    assert.ok(calls.some((call) => call.sql === 'PARSE' && String(call.params?.[0] || '').includes('便利店')));
    assert.ok(calls.some((call) => call.sql.startsWith('INSERT INTO chapters')));
    assert.ok(calls.some((call) => call.sql.startsWith('INSERT INTO scenes')));
    assert.ok(
      calls.some(
        (call) => call.sql.startsWith('INSERT INTO characters') && call.params?.includes('李明'),
      ),
    );
    assert.ok(
      calls.some(
        (call) =>
          call.sql.startsWith('INSERT INTO scene_asset_usages') && call.params?.includes('雨伞'),
      ) || calls.some((call) => call.sql.startsWith('INSERT INTO assets')),
    );
    assert.ok(calls.some((call) => call.sql === 'COMMIT'));
    assert.ok(!calls.some((call) => call.sql === 'ROLLBACK'));
  });

  it('rejects unknown projects before parsing', async () => {
    const { service, calls, parseScript } = makeService();
    Object.defineProperty(service, 'ctx', {
      value: { service: { project: { findById: async () => null } } },
    });
    await assert.rejects(service.parseAndImport(404, 'x', parseScript), /project not found/);
    assert.ok(!calls.some((call) => call.sql === 'PARSE'));
  });

  it('rolls back on mid-import failure', async () => {
    const { service, calls, parseScript } = makeService();
    Object.defineProperty(service, 'pool', {
      value: {
        getConnection: async () => ({
          beginTransaction: async () => undefined,
          query: async () => [[]],
          execute: async () => {
            throw new Error('db gone');
          },
          commit: async () => undefined,
          rollback: async () => {
            calls.push({ sql: 'ROLLBACK' });
          },
          release: () => undefined,
        }),
      },
    });
    await assert.rejects(service.parseAndImport(19, 'x', parseScript), /db gone/);
    assert.ok(calls.some((call) => call.sql === 'ROLLBACK'));
  });
});
