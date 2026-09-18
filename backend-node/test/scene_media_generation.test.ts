import assert from 'node:assert/strict';

import { describe, it } from 'mocha';

import * as SceneMediaGenerationServiceNamespace from '../app/service/scene_media_generation';

const SceneMediaGenerationService: any =
  (SceneMediaGenerationServiceNamespace as { default?: { prototype: object } }).default ||
  SceneMediaGenerationServiceNamespace;

const GENERATION_ROW = {
  id: 5,
  scene_id: 21,
  legacy_storyboard_id: null,
  media_type: 'cover',
  model: 'seedream-4.5',
  status: 'succeeded',
  result_url: '/generated/a.png',
  preview_url: '',
  poster_url: '',
  source_url: '',
  error_message: '',
  is_current: 1,
  meta_json: '',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function makeService() {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const pool = {
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [[GENERATION_ROW]];
    },
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [{ insertId: 6 }];
    },
  };
  const service = Object.create(SceneMediaGenerationService.prototype);
  Object.defineProperty(service, 'pool', { value: pool, configurable: true });
  Object.defineProperty(service, 'app', {
    value: { config: { storyboard: { publicAppBaseUrl: '' } } },
  });
  return { service, calls };
}

describe('test/scene_media_generation.test.ts', () => {
  it('maps rows with normalized urls and flags', async () => {
    const { service } = makeService();
    const found = await service.findById(5);
    assert.equal(found.id, 5);
    assert.equal(found.media_type, 'cover');
    assert.equal(found.is_current, true);
  });

  it('creates generations and returns the fresh row', async () => {
    const { service, calls } = makeService();
    const created = await service.create({ scene_id: 21, media_type: 'cover' });
    assert.equal(created.id, 5);
    const insert = calls.find((call) => call.sql.startsWith('INSERT INTO scene_media_generations'));
    assert.ok(insert);
    assert.equal(insert?.params?.[0], 21);
  });

  it('marks one generation current per scene and type', async () => {
    const { service, calls } = makeService();
    const servicePool = {
      getConnection: async () => ({
        beginTransaction: async () => undefined,
        execute: async (sql: string, params?: unknown[]) => {
          calls.push({ sql, params });
          return [{ affectedRows: 1 }];
        },
        commit: async () => undefined,
        rollback: async () => undefined,
        release: () => undefined,
      }),
    };
    Object.defineProperty(service, 'pool', { value: servicePool });
    await service.markCurrent(21, 'cover', 5);
    const update = calls.find((call) => call.sql.includes('is_current = 1'));
    assert.deepEqual(update?.params, [5, 21, 'cover']);
  });
});
