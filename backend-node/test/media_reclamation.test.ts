import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { describe, it } from 'mocha';

const cjsRequire = createRequire(import.meta.url);
const {
  isGeneratedPathReferenced,
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
});
