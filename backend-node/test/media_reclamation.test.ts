import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { describe, it } from 'mocha';

// @ts-expect-error: tests execute as ESM (mocha + Node type stripping) while tsc assumes CJS from package.json
const cjsRequire = createRequire(import.meta.url);
const {
  getHistoryKeepCount,
  isGeneratedPathReferenced,
  pruneOldGenerations,
  reclaimGeneratedPaths,
  sweepOrphanedFiles,
} = cjsRequire('../app/lib/media_reclamation');

function buildApp(root: string) {
  return {
    config: {
      storyboard: { generatedAssetBasePath: '/generated', generatedAssetDir: root },
    },
    logger: {},
  };
}

function buildPool(referenced: Set<string>) {
  return {
    async query(_sql: string, params: unknown[] = []) {
      const value = String(params[0] || '');
      return [referenced.has(value) ? [{ '1': 1 }] : [], []];
    },
  };
}

describe('test/media_reclamation.test.ts', () => {
  it('skips non-generated paths and deletes unreferenced ones', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reclaim-'));
    fs.mkdirSync(path.join(root, 'videos'), { recursive: true });
    fs.writeFileSync(path.join(root, 'videos', 'a.mp4'), 'x');
    const app = buildApp(root);
    const pool = buildPool(new Set());
    const result = await reclaimGeneratedPaths(app, pool, [
      'https://cdn.example.com/other.png',
      '/generated/videos/a.mp4',
      '/generated/videos/a.mp4',
    ]);
    assert.deepEqual(result.deleted, ['/generated/videos/a.mp4']);
    assert.deepEqual(result.skipped, ['https://cdn.example.com/other.png']);
    assert.equal(fs.existsSync(path.join(root, 'videos', 'a.mp4')), false);
  });

  it('keeps files still referenced by live rows', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reclaim-'));
    fs.mkdirSync(path.join(root, 'videos'), { recursive: true });
    fs.writeFileSync(path.join(root, 'videos', 'b.mp4'), 'x');
    const app = buildApp(root);
    const pool = buildPool(new Set(['/generated/videos/b.mp4']));
    assert.equal(await isGeneratedPathReferenced(pool, '/generated/videos/b.mp4'), true);
    const result = await reclaimGeneratedPaths(app, pool, ['/generated/videos/b.mp4']);
    assert.deepEqual(result.deleted, []);
    assert.deepEqual(result.skipped, ['/generated/videos/b.mp4']);
    assert.equal(fs.existsSync(path.join(root, 'videos', 'b.mp4')), true);
  });

  it('sweeps only stale unreferenced files and honors dry runs', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reclaim-'));
    fs.mkdirSync(path.join(root, 'videos'), { recursive: true });
    const oldOrphan = path.join(root, 'videos', 'old.mp4');
    const freshOrphan = path.join(root, 'videos', 'fresh.mp4');
    const oldKept = path.join(root, 'videos', 'kept.mp4');
    fs.writeFileSync(oldOrphan, 'x');
    fs.writeFileSync(freshOrphan, 'x');
    fs.writeFileSync(oldKept, 'x');
    const ancient = Date.now() - 48 * 3600 * 1000;
    fs.utimesSync(oldOrphan, new Date(ancient), new Date(ancient));
    fs.utimesSync(oldKept, new Date(ancient), new Date(ancient));
    const app = buildApp(root);
    const pool = buildPool(new Set(['/generated/videos/kept.mp4']));

    const dry = await sweepOrphanedFiles(app, pool, { olderThanMs: 3600 * 1000, dryRun: true });
    assert.equal(dry.scanned, 3);
    assert.deepEqual(dry.deleted, [oldOrphan]);
    assert.equal(fs.existsSync(oldOrphan), true);

    const real = await sweepOrphanedFiles(app, pool, { olderThanMs: 3600 * 1000 });
    assert.deepEqual(real.deleted, [oldOrphan]);
    assert.equal(fs.existsSync(oldOrphan), false);
    assert.equal(fs.existsSync(freshOrphan), true);
    assert.equal(fs.existsSync(oldKept), true);
  });

  it('prunes history beyond keep count but never touches current or generating rows', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reclaim-'));
    fs.mkdirSync(path.join(root, 'videos'), { recursive: true });
    for (const name of ['v5.mp4', 'v6.mp4', 'v7.mp4']) {
      fs.writeFileSync(path.join(root, 'videos', name), 'x');
    }
    const app = buildApp(root);
    const queries: string[] = [];
    const pool = {
      async query(sql: string) {
        queries.push(sql);
        if (sql.includes('`is_current`')) {
          return [
            [
              { id: 7, is_current: 1, result_url: '/generated/videos/v7.mp4' },
              { id: 6, is_current: 0, result_url: '/generated/videos/v6.mp4' },
              { id: 5, is_current: 0, result_url: '/generated/videos/v5.mp4' },
            ],
            [],
          ];
        }
        return [[], []];
      },
      async execute(sql: string, params: unknown[] = []) {
        queries.push(`${sql} :: ${JSON.stringify(params)}`);
        return [{ affectedRows: 1 }, []];
      },
    };
    const result = await pruneOldGenerations(app, pool, {
      table: 'scene_media_generations',
      ownerColumn: 'scene_id',
      ownerId: 21,
      mediaType: 'video',
      urlColumns: ['result_url'],
      keep: 2,
    });
    assert.deepEqual(result.pruned, [5]);
    assert.deepEqual(result.deleted, ['/generated/videos/v5.mp4']);
    assert.equal(fs.existsSync(path.join(root, 'videos', 'v5.mp4')), false);
    assert.equal(fs.existsSync(path.join(root, 'videos', 'v6.mp4')), true);
    assert.equal(fs.existsSync(path.join(root, 'videos', 'v7.mp4')), true);
    assert.ok(queries.some((sql) => sql.includes("!= 'generating'")));
    assert.ok(
      queries.some((sql) => sql.includes('SET `deleted_at` = NOW()') && sql.includes('[5]')),
    );
  });

  it('does nothing when history fits within keep count', async () => {
    const app = buildApp(os.tmpdir());
    let executed = 0;
    const pool = {
      async query(sql: string) {
        if (sql.includes('`is_current`')) {
          return [[{ id: 7, is_current: 1, result_url: '' }], []];
        }
        return [[], []];
      },
      async execute() {
        executed += 1;
        return [{ affectedRows: 1 }, []];
      },
    };
    const result = await pruneOldGenerations(app, pool, {
      table: 'storyboard_media_generations',
      ownerColumn: 'storyboard_id',
      ownerId: 146,
      mediaType: 'video',
      urlColumns: ['result_url', 'preview_url'],
      keep: 5,
    });
    assert.deepEqual(result, { pruned: [], deleted: [] });
    assert.equal(executed, 0);
  });

  it('reads history keep count from env with a floor of 1', () => {
    const prev = process.env.RECLAIM_HISTORY_KEEP;
    try {
      delete process.env.RECLAIM_HISTORY_KEEP;
      assert.equal(getHistoryKeepCount(), 10);
      process.env.RECLAIM_HISTORY_KEEP = '3';
      assert.equal(getHistoryKeepCount(), 3);
      process.env.RECLAIM_HISTORY_KEEP = '0';
      assert.equal(getHistoryKeepCount(), 10);
      process.env.RECLAIM_HISTORY_KEEP = 'abc';
      assert.equal(getHistoryKeepCount(), 10);
    } finally {
      if (prev === undefined) delete process.env.RECLAIM_HISTORY_KEEP;
      else process.env.RECLAIM_HISTORY_KEEP = prev;
    }
  });

  it('excludes pinned rows from prune candidates in SQL', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reclaim-'));
    fs.mkdirSync(path.join(root, 'videos'), { recursive: true });
    fs.writeFileSync(path.join(root, 'videos', 'old.mp4'), 'x');
    const app = buildApp(root);
    const queries: string[] = [];
    const pool = {
      async query(sql: string) {
        queries.push(sql);
        if (sql.includes('`is_current`')) {
          // 模拟 DB 侧已按 is_pinned = 0 过滤：钉住的旧行根本不会返回。
          return [
            [
              { id: 9, is_current: 1, result_url: '/generated/videos/new.mp4' },
              { id: 5, is_current: 0, result_url: '/generated/videos/old.mp4' },
            ],
            [],
          ];
        }
        return [[], []];
      },
      async execute() {
        return [{ affectedRows: 1 }, []];
      },
    };
    const result = await pruneOldGenerations(app, pool, {
      table: 'scene_media_generations',
      ownerColumn: 'scene_id',
      ownerId: 21,
      mediaType: 'video',
      urlColumns: ['result_url'],
      keep: 1,
    });
    assert.ok(queries.some((sql) => sql.includes('`is_pinned` = 0')));
    assert.deepEqual(result.pruned, [5]);
    assert.equal(fs.existsSync(path.join(root, 'videos', 'old.mp4')), false);
  });
});
