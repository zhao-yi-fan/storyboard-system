import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const mysql = require('mysql2/promise');
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseLimit() {
  const raw = process.argv.find((item) => item.startsWith('--limit='));
  if (!raw) return 0;
  const limit = Number(raw.slice('--limit='.length));
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('--limit must be a positive integer');
  }
  return limit;
}

async function main() {
  const configModule = require('../dist/config/config.default');
  const buildConfig = configModule.default || configModule;
  const config = buildConfig({ name: 'storyboard-backend-node' });
  const { ensureSceneGenerationSchema } = require('../dist/app/lib/scene_generation_schema');
  const { createPreviewFromSource, videoPosterSpec } = require('../dist/app/lib/media');
  const pool = mysql.createPool(config.mysql);
  const app = { baseDir: backendRoot, config };

  try {
    await ensureSceneGenerationSchema(pool);
    const limit = parseLimit();
    const [rows] = await pool.query(
      `SELECT sm.id, sm.scene_id, sm.result_url, sm.poster_url, s.video_poster_url
       FROM scene_media_generations sm
       JOIN scenes s ON s.id = sm.scene_id AND s.deleted_at IS NULL
       WHERE sm.media_type = 'video' AND sm.status = 'succeeded'
         AND sm.is_current = 1 AND sm.deleted_at IS NULL
         AND COALESCE(sm.result_url, '') <> ''
         AND (COALESCE(sm.poster_url, '') = '' OR COALESCE(s.video_poster_url, '') = '')
       ORDER BY sm.id ASC${limit ? ` LIMIT ${limit}` : ''}`,
    );

    let created = 0;
    let reused = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        let posterUrl = String(row.poster_url || '');
        if (!posterUrl) {
          posterUrl = await createPreviewFromSource(
            app,
            row.result_url,
            'scene-video-posters',
            `scene-${Number(row.scene_id)}-video-${Number(row.id)}-poster`,
            videoPosterSpec(),
          );
          await pool.execute('UPDATE scene_media_generations SET poster_url = ? WHERE id = ?', [
            posterUrl,
            row.id,
          ]);
          created++;
        } else {
          reused++;
        }
        await pool.execute(
          `UPDATE scenes SET video_poster_url = ?
           WHERE id = ? AND EXISTS (
             SELECT 1 FROM scene_media_generations sm
             WHERE sm.id = ? AND sm.scene_id = scenes.id AND sm.is_current = 1
               AND sm.deleted_at IS NULL
           )`,
          [posterUrl, row.scene_id, row.id],
        );
        console.log(`[video-poster] scene=${row.scene_id} generation=${row.id} ready`);
      } catch (error) {
        failed++;
        console.error(
          `[video-poster] scene=${row.scene_id} generation=${row.id} failed: ${error.message}`,
        );
      }
    }
    console.log(
      `[video-poster] complete total=${rows.length} created=${created} reused=${reused} failed=${failed}`,
    );
    if (failed) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
