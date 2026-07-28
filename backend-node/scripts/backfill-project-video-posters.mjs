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
  const ProjectVideoPosterService = require('../dist/app/service/project_video_poster');
  const pool = mysql.createPool(config.mysql);
  const app = { baseDir: backendRoot, config };

  try {
    await ensureSceneGenerationSchema(pool);
    const limit = parseLimit();
    const [rows] = await pool.query(
      `SELECT id, video_url
       FROM projects
       WHERE deleted_at IS NULL AND video_status = 'succeeded'
         AND COALESCE(video_url, '') <> ''
         AND COALESCE(video_poster_url, '') = ''
       ORDER BY id ASC${limit ? ` LIMIT ${limit}` : ''}`,
    );

    let created = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        const context = {
          app,
          buildBaseName: ProjectVideoPosterService.prototype.buildBaseName,
        };
        const posterUrl = await ProjectVideoPosterService.prototype.extract.call(
          context,
          row.id,
          row.video_url,
        );
        await pool.execute(
          `UPDATE projects SET video_poster_url = ?
           WHERE id = ? AND COALESCE(video_poster_url, '') = ''`,
          [posterUrl, row.id],
        );
        created++;
        console.log(`[project-video-poster] project=${row.id} ready`);
      } catch (error) {
        failed++;
        console.error(`[project-video-poster] project=${row.id} failed: ${error.message}`);
      }
    }
    console.log(
      `[project-video-poster] complete total=${rows.length} created=${created} failed=${failed}`,
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
