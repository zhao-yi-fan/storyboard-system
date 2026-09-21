'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const {
  deleteGeneratedAsset,
  generatedPublicPathFromObjectKey,
  isGeneratedAssetPath,
  resolveGeneratedAssetRoot,
} = require('./generated_asset');

export type ReclaimPool = {
  query: (sql: string, params?: unknown[]) => Promise<[any[], any[]]>;
};

export type ReclaimApp = {
  config: { storyboard?: Record<string, unknown> };
  logger?: { info?: (...args: unknown[]) => void; warn?: (...args: unknown[]) => void };
};

const URL_COLUMNS: Array<{ table: string; columns: string[] }> = [
  {
    table: 'scene_media_generations',
    columns: ['result_url', 'preview_url', 'poster_url'],
  },
  {
    table: 'storyboard_media_generations',
    columns: ['result_url', 'preview_url'],
  },
  {
    table: 'scenes',
    columns: ['cover_url', 'cover_preview_url', 'video_url', 'video_preview_url', 'video_poster_url'],
  },
  {
    table: 'storyboards',
    columns: ['thumbnail_url', 'thumbnail_preview_url', 'video_url', 'video_preview_url'],
  },
  {
    table: 'characters',
    columns: [
      'avatar_url',
      'avatar_preview_url',
      'design_sheet_url',
      'design_sheet_preview_url',
      'voice_reference_url',
    ],
  },
  {
    table: 'assets',
    columns: ['file_url', 'cover_url', 'thumbnail_url'],
  },
];

/**
 * 检查生成物地址是否仍被任何有效数据行引用。
 * 只认未软删除的行：用户已删的 history 不应再保护文件。
 */
export async function isGeneratedPathReferenced(
  pool: ReclaimPool,
  publicPath: unknown,
): Promise<boolean> {
  const value = String(publicPath || '').trim();
  if (!value) return false;
  for (const { table, columns } of URL_COLUMNS) {
    const where = columns.map((column) => `\`${column}\` = ?`).join(' OR ');
    const [rows] = await pool.query(
      `SELECT 1 FROM \`${table}\` WHERE deleted_at IS NULL AND (${where}) LIMIT 1`,
      columns.map(() => value),
    );
    if (rows.length) return true;
  }
  return false;
}

/**
 * 回收一批生成物地址：非生成物路径跳过，仍被引用跳过，
 * 删除失败只记录不抛错（回收绝不能破坏主流程）。
 * @returns {Promise<{ deleted: string[]; skipped: string[] }>} 删除与跳过清单。
 */
export async function reclaimGeneratedPaths(
  app: ReclaimApp,
  pool: ReclaimPool,
  publicPaths: unknown[],
): Promise<{ deleted: string[]; skipped: string[] }> {
  const deleted: string[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  for (const raw of publicPaths) {
    const value = String(raw || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    try {
      if (!isGeneratedAssetPath(app, value)) {
        skipped.push(value);
        continue;
      }
      if (await isGeneratedPathReferenced(pool, value)) {
        skipped.push(value);
        continue;
      }
      await deleteGeneratedAsset(app, value);
      deleted.push(value);
    } catch (error) {
      app.logger?.warn?.(`[reclaim] delete failed for ${value}: ${(error as Error).message}`);
      skipped.push(value);
    }
  }
  return { deleted, skipped };
}

async function listLocalFiles(root: string): Promise<Array<{ path: string; mtimeMs: number }>> {
  const out: Array<{ path: string; mtimeMs: number }> = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop() as string;
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      try {
        const stat = await fs.stat(full);
        out.push({ path: full, mtimeMs: stat.mtimeMs });
      } catch {
        continue;
      }
    }
  }
  return out;
}

/**
 * 巡检本地生成物目录，删除超过保留期且无任何数据行引用的孤儿文件。
 * OSS 模式跳过（bucket 可能混有非本应用对象，不敢按前缀全扫）。
 */
export async function sweepOrphanedFiles(
  app: ReclaimApp,
  pool: ReclaimPool,
  options: { olderThanMs?: number; dryRun?: boolean; limit?: number } = {},
): Promise<{ scanned: number; deleted: string[]; skipped: string[] }> {
  const olderThanMs = options.olderThanMs ?? 24 * 3600 * 1000;
  const dryRun = options.dryRun ?? false;
  const limit = options.limit ?? 500;
  const root = await resolveGeneratedAssetRoot(app);
  const files = await listLocalFiles(root);
  const now = Date.now();
  const deleted: string[] = [];
  const skipped: string[] = [];
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  for (const file of files) {
    if (deleted.length >= limit) break;
    if (now - file.mtimeMs < olderThanMs) {
      skipped.push(file.path);
      continue;
    }
    const relative = file.path.startsWith(rootWithSep)
      ? file.path.slice(rootWithSep.length)
      : path.basename(file.path);
    const publicPath = generatedPublicPathFromObjectKey(
      app,
      relative.split(path.sep).join('/'),
    );
    try {
      if (await isGeneratedPathReferenced(pool, publicPath)) {
        skipped.push(file.path);
        continue;
      }
      if (!dryRun) {
        await deleteGeneratedAsset(app, publicPath);
      }
      deleted.push(file.path);
    } catch (error) {
      app.logger?.warn?.(`[reclaim] sweep failed for ${file.path}: ${(error as Error).message}`);
      skipped.push(file.path);
    }
  }
  return { scanned: files.length, deleted, skipped };
}
