'use strict';
// @ts-nocheck

async function columnExists(pool, tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [tableName, columnName],
  );
  return rows.length > 0;
}

async function addColumnIfMissing(pool, tableName, columnName, definition) {
  if (!(await columnExists(pool, tableName, columnName))) {
    await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
  }
}

async function indexExists(pool, tableName, indexName) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [tableName, indexName],
  );
  return rows.length > 0;
}

function hasCompleteLegacySceneMapping(storyboards, scenes) {
  if (storyboards.length !== scenes.length) return false;
  const expectedIds = new Set(storyboards.map((item) => Number(item.id)));
  const mappedIds = new Set(
    scenes.map((item) => Number(item.legacy_storyboard_id)).filter(Boolean),
  );
  return expectedIds.size === mappedIds.size && [...expectedIds].every((id) => mappedIds.has(id));
}

function _mergeLegacyPrompts(storyboards) {
  const prompts = storyboards.map((item) => String(item.content || '').trim()).filter(Boolean);
  if (prompts.length <= 1) return prompts[0] || '';
  let nextShotNumber = 1;
  return prompts
    .map((prompt) => {
      const hasShotMarker = /(?:^|\n)\s*镜号\s*[：:]/m.test(prompt);
      if (hasShotMarker) {
        return prompt.replace(/镜号\s*[：:]\s*\d+/g, () => `镜号：${nextShotNumber++}`);
      }
      return `镜号：${nextShotNumber++}\n${prompt}`;
    })
    .join('\n\n');
}

async function _migrateLegacySceneData(connection) {
  const [scenes] = await connection.query(
    `SELECT id, prompt, cover_url, cover_preview_url, video_url, video_preview_url,
            video_status, video_error, video_duration
     FROM scenes
     WHERE deleted_at IS NULL AND legacy_storyboards_migrated_at IS NULL
     ORDER BY id ASC`,
  );

  for (const scene of scenes) {
    const [storyboards] = await connection.query(
      `SELECT id, content, thumbnail_url, thumbnail_preview_url, video_url, video_preview_url,
              video_status, video_error, video_duration
       FROM storyboards
       WHERE scene_id = ? AND deleted_at IS NULL
       ORDER BY sort_order ASC, id ASC`,
      [scene.id],
    );
    if (!storyboards.length) {
      await connection.execute(
        'UPDATE scenes SET legacy_storyboards_migrated_at = NOW() WHERE id = ?',
        [scene.id],
      );
      continue;
    }

    const first = storyboards[0];
    const only = storyboards.length === 1 ? first : null;
    const prompt = String(scene.prompt || '').trim() || _mergeLegacyPrompts(storyboards);
    await connection.execute(
      `UPDATE scenes
       SET prompt = ?,
           cover_url = CASE WHEN COALESCE(cover_url, '') = '' THEN ? ELSE cover_url END,
           cover_preview_url = CASE WHEN COALESCE(cover_preview_url, '') = '' THEN ? ELSE cover_preview_url END,
           video_url = CASE WHEN COALESCE(video_url, '') = '' THEN ? ELSE video_url END,
           video_preview_url = CASE WHEN COALESCE(video_preview_url, '') = '' THEN ? ELSE video_preview_url END,
           video_status = CASE WHEN COALESCE(video_status, '') = '' THEN ? ELSE video_status END,
           video_error = CASE WHEN COALESCE(video_error, '') = '' THEN ? ELSE video_error END,
           video_duration = COALESCE(video_duration, ?),
           legacy_storyboards_migrated_at = NOW()
       WHERE id = ?`,
      [
        prompt,
        first.thumbnail_url || '',
        first.thumbnail_preview_url || '',
        only?.video_url || '',
        only?.video_preview_url || '',
        only?.video_status || '',
        only?.video_error || '',
        only?.video_duration || null,
        scene.id,
      ],
    );

    await connection.execute(
      `INSERT IGNORE INTO scene_characters (scene_id, character_id, line)
       SELECT ?, sc.character_id, MAX(sc.line)
       FROM storyboard_characters sc
       JOIN storyboards sb ON sb.id = sc.storyboard_id
       WHERE sb.scene_id = ? AND sb.deleted_at IS NULL
       GROUP BY sc.character_id`,
      [scene.id, scene.id],
    );
    await connection.execute(
      `INSERT IGNORE INTO scene_asset_usages (scene_id, asset_id, usage_type)
       SELECT ?, sau.asset_id, MAX(sau.usage_type)
       FROM storyboard_asset_usages sau
       JOIN storyboards sb ON sb.id = sau.storyboard_id
       WHERE sb.scene_id = ? AND sb.deleted_at IS NULL
       GROUP BY sau.asset_id`,
      [scene.id, scene.id],
    );
    await connection.execute(
      `INSERT IGNORE INTO scene_media_generations
        (scene_id, legacy_storyboard_id, legacy_generation_id, media_type, model, status, result_url, preview_url,
         source_url, error_message, is_current, meta_json, created_at, updated_at, deleted_at)
       SELECT ?, smg.storyboard_id, smg.id, smg.media_type, smg.model, smg.status, smg.result_url,
              smg.preview_url, smg.source_url, smg.error_message, 0, smg.meta_json,
              smg.created_at, smg.updated_at, smg.deleted_at
       FROM storyboard_media_generations smg
       JOIN storyboards sb ON sb.id = smg.storyboard_id
       WHERE sb.scene_id = ?`,
      [scene.id, scene.id],
    );

    const promotedCoverUrl = scene.cover_url || first.thumbnail_url || '';
    const promotedCoverPreviewUrl = scene.cover_preview_url || first.thumbnail_preview_url || '';
    if (promotedCoverUrl) {
      await connection.execute(
        `INSERT INTO scene_media_generations
          (scene_id, media_type, model, status, result_url, preview_url, is_current, meta_json)
         VALUES (?, 'cover', 'legacy-promoted', 'succeeded', ?, ?, 0, ?)`,
        [
          scene.id,
          promotedCoverUrl,
          promotedCoverPreviewUrl || promotedCoverUrl,
          JSON.stringify({ source: 'legacy-scene-or-first-storyboard' }),
        ],
      );
    }
    const promotedVideoUrl = scene.video_url || only?.video_url || '';
    const promotedVideoPreviewUrl = scene.video_preview_url || only?.video_preview_url || '';
    if (promotedVideoUrl) {
      await connection.execute(
        `INSERT INTO scene_media_generations
          (scene_id, media_type, model, status, result_url, preview_url, is_current, meta_json)
         VALUES (?, 'video', 'legacy-promoted', 'succeeded', ?, ?, 0, ?)`,
        [
          scene.id,
          promotedVideoUrl,
          promotedVideoPreviewUrl || promotedVideoUrl,
          JSON.stringify({
            source: storyboards.length === 1 ? 'single-storyboard' : 'scene-composition',
            legacy_storyboard_count: storyboards.length,
          }),
        ],
      );
    }

    for (const mediaType of ['cover', 'video']) {
      const [currentRows] = await connection.query(
        `SELECT id FROM scene_media_generations
         WHERE scene_id = ? AND media_type = ? AND deleted_at IS NULL AND status = 'succeeded'
         ORDER BY is_current DESC, created_at DESC, id DESC LIMIT 1`,
        [scene.id, mediaType],
      );
      if (currentRows.length) {
        await connection.execute(
          'UPDATE scene_media_generations SET is_current = (id = ?) WHERE scene_id = ? AND media_type = ?',
          [currentRows[0].id, scene.id, mediaType],
        );
      }
    }
  }
}

async function selectCurrentSceneMedia(connection, sceneId, mediaType, storyboardId, preserveNew) {
  if (preserveNew) {
    const [newRows] = await connection.query(
      `SELECT id, result_url, preview_url, status, error_message
       FROM scene_media_generations
       WHERE scene_id = ? AND media_type = ? AND deleted_at IS NULL
         AND legacy_storyboard_id IS NULL AND model NOT IN ('legacy-promoted', 'legacy-ffmpeg-compose')
         AND is_current = 1 AND status = 'succeeded' AND COALESCE(result_url, '') <> ''
       ORDER BY id DESC LIMIT 1`,
      [sceneId, mediaType],
    );
    if (newRows.length) return newRows[0];
  }
  const [legacyRows] = await connection.query(
    `SELECT sm.id, sm.result_url, sm.preview_url, sm.status, sm.error_message
     FROM scene_media_generations sm
     LEFT JOIN storyboard_media_generations old ON old.id = sm.legacy_generation_id
     WHERE sm.scene_id = ? AND sm.media_type = ? AND sm.deleted_at IS NULL
       AND sm.legacy_storyboard_id = ? AND sm.status = 'succeeded'
       AND COALESCE(sm.result_url, '') <> ''
     ORDER BY COALESCE(old.is_current, 0) DESC, sm.created_at DESC, sm.id DESC LIMIT 1`,
    [sceneId, mediaType, storyboardId],
  );
  return legacyRows[0] || null;
}

async function migrateLegacyStoryboardsToScenes(connection) {
  const [chapters] = await connection.query(
    `SELECT c.id
     FROM chapters c
     JOIN scenes s ON s.chapter_id = c.id AND s.deleted_at IS NULL
     JOIN storyboards sb ON sb.scene_id = s.id AND sb.deleted_at IS NULL
     WHERE c.deleted_at IS NULL
     GROUP BY c.id, c.sort_order
     ORDER BY c.sort_order ASC, c.id ASC`,
  );

  for (const chapter of chapters) {
    const [sourceScenes] = await connection.query(
      `SELECT id, chapter_id, project_id, title, description, location, time_of_day,
              style_preset, style_notes, sort_order, legacy_storyboards_split_at
       FROM scenes
       WHERE chapter_id = ? AND deleted_at IS NULL AND legacy_parent_scene_id IS NULL
       ORDER BY sort_order ASC, id ASC`,
      [chapter.id],
    );
    const orderedSceneIds = [];

    for (const source of sourceScenes) {
      const [storyboards] = await connection.query(
        `SELECT id, content, thumbnail_url, thumbnail_preview_url, video_url, video_preview_url,
                video_status, video_error, video_duration, duration, sort_order
         FROM storyboards
         WHERE scene_id = ? AND deleted_at IS NULL
         ORDER BY sort_order ASC, id ASC`,
        [source.id],
      );
      if (!storyboards.length) {
        orderedSceneIds.push(Number(source.id));
        continue;
      }
      if (source.legacy_storyboards_split_at) {
        const [alreadySplit] = await connection.query(
          `SELECT s.id, s.legacy_storyboard_id
           FROM scenes s
           LEFT JOIN storyboards sb ON sb.id = s.legacy_storyboard_id
           WHERE s.deleted_at IS NULL AND (s.id = ? OR s.legacy_parent_scene_id = ?)
           ORDER BY COALESCE(sb.sort_order, 0) ASC, s.id ASC`,
          [source.id, source.id],
        );
        if (hasCompleteLegacySceneMapping(storyboards, alreadySplit)) {
          orderedSceneIds.push(...alreadySplit.map((item) => Number(item.id)));
          continue;
        }
      }

      await connection.execute(
        `UPDATE scene_media_generations
         SET deleted_at = COALESCE(deleted_at, NOW()), is_current = 0
         WHERE scene_id = ? AND model IN ('legacy-promoted', 'legacy-ffmpeg-compose')`,
        [source.id],
      );

      for (let index = 0; index < storyboards.length; index++) {
        const storyboard = storyboards[index];
        let targetSceneId;
        if (index === 0) {
          targetSceneId = Number(source.id);
        } else {
          const [mapped] = await connection.query(
            `SELECT id FROM scenes
             WHERE legacy_storyboard_id = ? AND deleted_at IS NULL LIMIT 1`,
            [storyboard.id],
          );
          if (mapped.length) {
            targetSceneId = Number(mapped[0].id);
          } else {
            const [insert] = await connection.execute(
              `INSERT INTO scenes (
                 chapter_id, project_id, title, description, prompt, location, time_of_day,
                 style_preset, style_notes, cover_url, cover_preview_url, video_url,
                 video_preview_url, video_status, video_error, video_duration,
                 generation_duration, sort_order, legacy_storyboard_id, legacy_parent_scene_id,
                 legacy_storyboards_migrated_at, legacy_storyboards_split_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
              [
                source.chapter_id,
                source.project_id,
                `${source.title} · ${index + 1}`,
                source.description || '',
                String(storyboard.content || ''),
                source.location || '',
                source.time_of_day || '',
                source.style_preset || '',
                source.style_notes || '',
                storyboard.thumbnail_url || '',
                storyboard.thumbnail_preview_url || '',
                storyboard.video_url || '',
                storyboard.video_preview_url || '',
                storyboard.video_status || '',
                storyboard.video_error || '',
                storyboard.video_duration || null,
                Number(storyboard.duration || storyboard.video_duration || 5),
                source.sort_order,
                storyboard.id,
                source.id,
              ],
            );
            targetSceneId = Number(insert.insertId);
          }
        }
        orderedSceneIds.push(targetSceneId);

        const title =
          storyboards.length === 1 || index === 0 ? source.title : `${source.title} · ${index + 1}`;
        await connection.execute(
          `UPDATE scenes
           SET title = ?, prompt = ?, cover_url = ?, cover_preview_url = ?, video_url = ?,
               video_preview_url = ?, video_status = ?, video_error = ?, video_duration = ?,
               generation_duration = ?, legacy_storyboard_id = ?,
               legacy_storyboards_split_at = CASE WHEN id = ? THEN NULL ELSE NOW() END
           WHERE id = ?`,
          [
            title,
            String(storyboard.content || ''),
            storyboard.thumbnail_url || '',
            storyboard.thumbnail_preview_url || '',
            storyboard.video_url || '',
            storyboard.video_preview_url || '',
            storyboard.video_status || '',
            storyboard.video_error || '',
            storyboard.video_duration || null,
            Number(storyboard.duration || storyboard.video_duration || 5),
            storyboard.id,
            source.id,
            targetSceneId,
          ],
        );

        await connection.execute('DELETE FROM scene_characters WHERE scene_id = ?', [
          targetSceneId,
        ]);
        await connection.execute('DELETE FROM scene_asset_usages WHERE scene_id = ?', [
          targetSceneId,
        ]);
        await connection.execute(
          `INSERT IGNORE INTO scene_characters (scene_id, character_id, line)
           SELECT ?, character_id, line FROM storyboard_characters WHERE storyboard_id = ?`,
          [targetSceneId, storyboard.id],
        );
        await connection.execute(
          `INSERT IGNORE INTO scene_asset_usages (scene_id, asset_id, usage_type)
           SELECT ?, asset_id, usage_type FROM storyboard_asset_usages WHERE storyboard_id = ?`,
          [targetSceneId, storyboard.id],
        );

        await connection.execute(
          `UPDATE scene_media_generations SET scene_id = ?
           WHERE legacy_storyboard_id = ?`,
          [targetSceneId, storyboard.id],
        );
        await connection.execute(
          `INSERT IGNORE INTO scene_media_generations
            (scene_id, legacy_storyboard_id, legacy_generation_id, media_type, model, status,
             result_url, preview_url, source_url, error_message, is_current, meta_json,
             created_at, updated_at, deleted_at)
           SELECT ?, smg.storyboard_id, smg.id, smg.media_type, smg.model, smg.status,
                  smg.result_url, smg.preview_url, smg.source_url, smg.error_message, 0,
                  smg.meta_json, smg.created_at, smg.updated_at, smg.deleted_at
           FROM storyboard_media_generations smg WHERE smg.storyboard_id = ?`,
          [targetSceneId, storyboard.id],
        );

        const preserveNew = index === 0;
        for (const mediaType of ['cover', 'video']) {
          const current = await selectCurrentSceneMedia(
            connection,
            targetSceneId,
            mediaType,
            storyboard.id,
            preserveNew,
          );
          await connection.execute(
            'UPDATE scene_media_generations SET is_current = 0 WHERE scene_id = ? AND media_type = ?',
            [targetSceneId, mediaType],
          );
          if (current) {
            await connection.execute(
              'UPDATE scene_media_generations SET is_current = 1 WHERE id = ?',
              [current.id],
            );
            if (mediaType === 'cover') {
              await connection.execute(
                'UPDATE scenes SET cover_url = ?, cover_preview_url = ? WHERE id = ?',
                [
                  current.result_url || '',
                  current.preview_url || current.result_url || '',
                  targetSceneId,
                ],
              );
            } else {
              await connection.execute(
                `UPDATE scenes SET video_url = ?, video_preview_url = ?, video_status = ?, video_error = ?
                 WHERE id = ?`,
                [
                  current.result_url || '',
                  current.preview_url || current.result_url || '',
                  current.status || '',
                  current.error_message || '',
                  targetSceneId,
                ],
              );
            }
          }
        }
      }
      await connection.execute(
        'UPDATE scenes SET legacy_storyboards_split_at = NOW() WHERE id = ?',
        [source.id],
      );
    }

    for (let index = 0; index < orderedSceneIds.length; index++) {
      await connection.execute('UPDATE scenes SET sort_order = ? WHERE id = ?', [
        index + 1,
        orderedSceneIds[index],
      ]);
    }
  }
}

export async function ensureSceneGenerationSchema(pool) {
  const connection = await pool.getConnection();
  try {
    const [locks] = await connection.query(
      "SELECT GET_LOCK('storyboard_scene_generation_schema', 300) AS acquired",
    );
    if (Number(locks[0]?.acquired) !== 1) {
      throw new Error('scene generation schema migration lock timeout');
    }

    await addColumnIfMissing(connection, 'scenes', 'prompt', 'LONGTEXT NULL AFTER description');
    await addColumnIfMissing(
      connection,
      'scenes',
      'generation_duration',
      'INT NOT NULL DEFAULT 5 AFTER video_duration',
    );
    await addColumnIfMissing(
      connection,
      'scenes',
      'legacy_storyboards_migrated_at',
      'DATETIME NULL AFTER generation_duration',
    );
    await addColumnIfMissing(
      connection,
      'scenes',
      'legacy_storyboard_id',
      'BIGINT UNSIGNED NULL AFTER legacy_storyboards_migrated_at',
    );
    await addColumnIfMissing(
      connection,
      'scenes',
      'legacy_parent_scene_id',
      'BIGINT UNSIGNED NULL AFTER legacy_storyboard_id',
    );
    await addColumnIfMissing(
      connection,
      'scenes',
      'legacy_storyboards_split_at',
      'DATETIME NULL AFTER legacy_parent_scene_id',
    );

    await connection.query(`
      CREATE TABLE IF NOT EXISTS scene_characters (
        scene_id BIGINT UNSIGNED NOT NULL,
        character_id BIGINT UNSIGNED NOT NULL,
        line TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (scene_id, character_id),
        KEY idx_scene_characters_character (character_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS scene_asset_usages (
        scene_id BIGINT UNSIGNED NOT NULL,
        asset_id BIGINT UNSIGNED NOT NULL,
        usage_type VARCHAR(64) NOT NULL DEFAULT 'reference_asset',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (scene_id, asset_id, usage_type),
        KEY idx_scene_asset_usages_asset (asset_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS scene_media_generations (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        scene_id BIGINT UNSIGNED NOT NULL,
        legacy_storyboard_id BIGINT UNSIGNED NULL,
        legacy_generation_id BIGINT UNSIGNED NULL,
        media_type VARCHAR(32) NOT NULL,
        model VARCHAR(64) NOT NULL DEFAULT '',
        status VARCHAR(32) NOT NULL,
        result_url TEXT NULL,
        preview_url TEXT NULL,
        source_url TEXT NULL,
        error_message TEXT NULL,
        is_current TINYINT(1) NOT NULL DEFAULT 0,
        meta_json LONGTEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_scene_media_legacy (legacy_generation_id),
        KEY idx_scene_media_history (scene_id, media_type, created_at),
        KEY idx_scene_media_current (scene_id, media_type, is_current)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await addColumnIfMissing(
      connection,
      'scene_media_generations',
      'legacy_generation_id',
      'BIGINT UNSIGNED NULL AFTER legacy_storyboard_id',
    );
    await connection.query(`
      CREATE TABLE IF NOT EXISTS scene_video_frames (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        project_id BIGINT UNSIGNED NOT NULL,
        source_scene_id BIGINT UNSIGNED NOT NULL,
        source_generation_id BIGINT UNSIGNED NOT NULL,
        timestamp_ms INT UNSIGNED NOT NULL,
        file_url TEXT NOT NULL,
        preview_url TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_scene_video_frame_time (source_generation_id, timestamp_ms),
        KEY idx_scene_video_frames_scene (source_scene_id, created_at),
        KEY idx_scene_video_frames_project (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS scene_video_frame_usages (
        frame_id BIGINT UNSIGNED NOT NULL,
        target_scene_id BIGINT UNSIGNED NOT NULL,
        usage_type VARCHAR(64) NOT NULL DEFAULT 'reference_image',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (frame_id, target_scene_id),
        KEY idx_scene_video_frame_usage_target (target_scene_id, usage_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    const splitMigrationComplete = await indexExists(
      connection,
      'scenes',
      'uk_scenes_legacy_storyboard',
    );
    if (!splitMigrationComplete) {
      await migrateLegacyStoryboardsToScenes(connection);
      await connection.query(
        'ALTER TABLE scenes ADD UNIQUE KEY uk_scenes_legacy_storyboard (legacy_storyboard_id)',
      );
    }
    await connection.execute(
      `UPDATE scene_media_generations sm
       JOIN scenes s ON s.id = sm.scene_id
       LEFT JOIN storyboards sb ON sb.id = sm.legacy_storyboard_id
       SET sm.deleted_at = COALESCE(sm.deleted_at, NOW()), sm.is_current = 0
       WHERE sm.deleted_at IS NULL AND sm.legacy_storyboard_id IS NOT NULL
         AND sm.legacy_storyboard_id <> s.legacy_storyboard_id
         AND (sb.id IS NULL OR sb.deleted_at IS NOT NULL)`,
    );
  } finally {
    await connection
      .query("SELECT RELEASE_LOCK('storyboard_scene_generation_schema')")
      .catch(() => null);
    connection.release();
  }
}

export { hasCompleteLegacySceneMapping };
