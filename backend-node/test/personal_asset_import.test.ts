import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { describe, it } from 'mocha';
// @ts-expect-error: tests execute as ESM while the application compiles to CJS
const require = createRequire(import.meta.url);
const ImportService = require('../app/service/personal_asset_import');
const VersionService = require('../app/service/asset_versioning');
type Row = Record<string, any>;

function fixture(kind = 'character') {
  let state = {
    entity: {
      id: 8,
      project_id: 30,
      type: kind,
      name: '林婉',
      description: '剧本身份',
      meta: '原描述',
      avatar_url: '/generated/ref.png',
      design_sheet_url: '/generated/old.png',
      file_url: '/generated/original.png',
      cover_url: '/generated/old.png',
      thumbnail_url: '/generated/old-thumb.png',
      voice_reference_url: '/generated/voice.wav',
    } as Row,
    source: {
      id: 1,
      user_id: 7,
      kind,
      name: '个人素材',
      description: '素材描述',
      file_url: '/generated/new.png',
      preview_url: '/generated/new-thumb.png',
    } as Row,
    versions: [] as Row[],
    requirement: null as Row | null,
  };
  const writes: Array<{ sql: string; params: any[] }> = [];
  let snapshot = structuredClone(state);
  let committed = false;
  let rolledBack = false;
  let released = false;
  let fail = '';
  const conn = {
    async beginTransaction() {
      snapshot = structuredClone(state);
    },
    async query(sql: string, params: any[] = []) {
      if (sql.includes('FROM projects'))
        return [params[0] === 30 && params[1] === 7 ? [{ id: 30 }] : [], []];
      if (sql.includes('FROM personal_assets'))
        return [
          params[0] === state.source.id &&
          params[1] === state.source.user_id &&
          !state.source.deleted_at
            ? [state.source]
            : [],
          [],
        ];
      if (sql.includes('FROM asset_requirements'))
        return [
          state.requirement && params[0] === state.requirement.id ? [state.requirement] : [],
          [],
        ];
      if (sql.includes('SELECT e.*'))
        return [
          params[0] === state.entity.id && params[1] === 7 && !state.entity.deleted_at
            ? [state.entity]
            : [],
          [],
        ];
      if (sql.includes('FROM asset_versions'))
        return [
          sql.includes('WHERE id =')
            ? state.versions.filter((v) => v.id === params[0])
            : state.versions,
          [],
        ];
      throw new Error(`Unexpected query: ${sql}`);
    },
    async execute(sql: string, params: any[] = []) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      writes.push({ sql: normalized, params });
      if (fail && normalized.includes(fail)) throw new Error('模拟数据库失败');
      if (normalized.startsWith('INSERT INTO asset_versions')) {
        const id = state.versions.length + 10;
        state.versions.push({
          id,
          entity_type: params[1],
          entity_id: params[2],
          file_url: params[3],
          preview_url: params[4],
          model: params[5],
          source_type: params[6],
          source_personal_asset_id: params[7],
          is_current: 0,
          status: 'succeeded',
        });
        return [{ insertId: id }, []];
      }
      if (
        normalized.startsWith('INSERT INTO characters') ||
        normalized.startsWith('INSERT INTO assets')
      ) {
        state.entity = { id: 200, project_id: params[0], name: params[1], description: params[2] };
        return [{ insertId: 200 }, []];
      }
      if (normalized.startsWith('UPDATE asset_versions SET is_current = 0'))
        state.versions.forEach((v) => {
          v.is_current = 0;
        });
      if (normalized.startsWith('UPDATE asset_versions SET is_current = 1')) {
        const version = state.versions.find((v) => v.id === params[0]);
        if (version) version.is_current = 1;
      }
      if (normalized.startsWith('UPDATE characters SET design_sheet_url'))
        state.entity.design_sheet_url = params[0];
      if (normalized.startsWith('UPDATE assets SET cover_url')) {
        state.entity.cover_url = params[0];
        state.entity.thumbnail_url = params[1];
      }
      if (
        normalized.startsWith('UPDATE asset_requirements SET linked_entity_type') &&
        state.requirement
      ) {
        state.requirement.linked_entity_type = params[0];
        state.requirement.linked_entity_id = params[1];
      }
      return [{ affectedRows: 1 }, []];
    },
    async commit() {
      committed = true;
    },
    async rollback() {
      rolledBack = true;
      state = snapshot;
    },
    release() {
      released = true;
    },
  };
  const app = { config: { storyboard: {} }, mysqlPool: { getConnection: async () => conn } };
  const service = Object.create(ImportService.prototype);
  service.app = app;
  return {
    service,
    conn,
    app,
    writes,
    get state() {
      return state;
    },
    get committed() {
      return committed;
    },
    get rolledBack() {
      return rolledBack;
    },
    get released() {
      return released;
    },
    failAt: (value: string) => {
      fail = value;
    },
  };
}

describe('personal asset image transactions', () => {
  it('applies a character image without changing identity, reference or voice and retains a restorable old version', async () => {
    const f = fixture();
    const result = await f.service.execute(1, 30, 7, { type: 'character', id: 8 });
    assert.equal(result.changed, true);
    assert.equal(f.state.entity.name, '林婉');
    assert.equal(f.state.entity.description, '剧本身份');
    assert.equal(f.state.entity.avatar_url, '/generated/ref.png');
    assert.equal(f.state.entity.voice_reference_url, '/generated/voice.wav');
    assert.equal(f.state.entity.design_sheet_url, '/generated/new.png');
    assert.equal(f.state.versions.length, 2);
    assert.equal(f.state.versions.filter((v) => v.is_current).length, 1);
    assert.equal(f.state.versions[1].source_personal_asset_id, 1);
    assert.equal(f.state.versions[1].model, 'personal-import');
    await f.service.execute(1, 30, 7, { type: 'character', id: 8 });
    assert.equal(f.state.versions.length, 2);
    const versions = Object.create(VersionService.prototype);
    versions.app = f.app;
    versions.listVersions = async () => f.state.versions;
    await versions.setCurrentVersion('character', 8, 10, 7);
    assert.equal(f.state.entity.design_sheet_url, '/generated/old.png');
    assert.ok(f.committed && f.released);
  });
  it('only changes the scene cover and thumbnail, not its original material or description', async () => {
    const f = fixture('scene');
    await f.service.execute(1, 30, 7, { type: 'asset', id: 8 });
    assert.equal(f.state.entity.file_url, '/generated/original.png');
    assert.equal(f.state.entity.meta, '原描述');
    assert.equal(f.state.entity.cover_url, '/generated/new.png');
    assert.equal(f.state.entity.thumbnail_url, '/generated/new-thumb.png');
  });
  it('creates an independent snapshot and initial version without binding a requirement', async () => {
    const f = fixture();
    const result = await f.service.execute(1, 30, 7);
    assert.equal(result.entity_id, 200);
    assert.equal(f.state.entity.name, '个人素材');
    assert.equal(f.state.versions.length, 1);
    assert.equal(
      f.writes.some((w) => w.sql.includes('SET linked_entity_type')),
      false,
    );
  });
  it('handles legacy linked requirements without renaming the project entity', async () => {
    const f = fixture();
    f.state.requirement = {
      id: 20,
      kind: 'character',
      name: '需求身份',
      linked_entity_type: 'character',
      linked_entity_id: 8,
    };
    await f.service.execute(1, 30, 7, undefined, 20);
    assert.equal(f.state.entity.name, '林婉');
  });
  it('creates an unlinked legacy requirement using the requirement identity', async () => {
    const f = fixture();
    f.state.requirement = { id: 20, kind: 'character', name: '需求身份', description: '需求描述' };
    await f.service.execute(1, 30, 7, undefined, 20);
    assert.equal(f.state.entity.name, '需求身份');
    assert.equal(f.state.entity.description, '需求描述');
    assert.equal(f.state.requirement.linked_entity_id, 200);
  });
  for (const test of [
    'owner',
    'source-owner',
    'deleted',
    'cross-project',
    'kind',
    'generating',
    'non-image',
  ]) {
    it(`rejects ${test} without committing`, async () => {
      const f = fixture();
      if (test === 'source-owner') f.state.source.user_id = 99;
      if (test === 'deleted') f.state.entity.deleted_at = new Date();
      if (test === 'cross-project') f.state.entity.project_id = 99;
      if (test === 'kind') f.state.source.kind = 'scene';
      if (test === 'generating') f.state.entity.design_sheet_status = 'generating';
      if (test === 'non-image') f.state.source.file_url = '/generated/video.mp4';
      await assert.rejects(
        f.service.execute(1, 30, test === 'owner' ? 99 : 7, { type: 'character', id: 8 }),
      );
      assert.equal(f.committed, false);
      assert.ok(f.rolledBack && f.released);
    });
  }
  it('rolls back entity, versions and requirements together on a write failure', async () => {
    const f = fixture();
    f.failAt('UPDATE asset_requirements SET status');
    await assert.rejects(
      f.service.execute(1, 30, 7, { type: 'character', id: 8 }),
      /模拟数据库失败/,
    );
    assert.equal(f.state.entity.design_sheet_url, '/generated/old.png');
    assert.equal(f.state.versions.length, 0);
    assert.ok(f.rolledBack && f.released);
  });
});
