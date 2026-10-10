'use strict';

import type { DbPool } from './entity';

export async function ensureLocalWorkerSchema(pool: DbPool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS local_video_jobs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    scene_id BIGINT UNSIGNED NOT NULL,
    generation_id BIGINT UNSIGNED NOT NULL,
    owner_id BIGINT UNSIGNED NOT NULL,
    input_json JSON NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    claim_token VARCHAR(64) NULL,
    heartbeat_at DATETIME NULL,
    prompt_id VARCHAR(64) NULL,
    object_key VARCHAR(255) NULL,
    actual_duration DOUBLE NULL,
    error_message TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY generation_job (generation_id),
    KEY claim_queue (owner_id, status, id),
    KEY scene_jobs (scene_id, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}
