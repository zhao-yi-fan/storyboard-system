'use strict';

type PoolLike = {
  execute: (sql: string, values?: unknown[]) => Promise<unknown>;
};

export async function ensureShotDirectionAnalysisSchema(pool: PoolLike) {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS storyboard_direction_analyses (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      project_id BIGINT UNSIGNED NOT NULL,
      scene_id BIGINT UNSIGNED NOT NULL,
      storyboard_id BIGINT UNSIGNED NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      result_json JSON NULL,
      error_message TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      PRIMARY KEY (id),
      KEY idx_direction_scene_active (scene_id, deleted_at),
      KEY idx_direction_storyboard_active (storyboard_id, deleted_at),
      KEY idx_direction_project_scene (project_id, scene_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}
