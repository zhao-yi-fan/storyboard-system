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

async function ensureProjectNameConstraint(pool) {
  await addColumnIfMissing(
    pool,
    'projects',
    'active_name',
    `VARCHAR(191) GENERATED ALWAYS AS
     (CASE WHEN deleted_at IS NULL THEN name ELSE NULL END) STORED`,
  );
  if (!(await indexExists(pool, 'projects', 'uk_projects_user_active_name'))) {
    await pool.query(
      'ALTER TABLE projects ADD UNIQUE KEY uk_projects_user_active_name (user_id, active_name)',
    );
  }
  if (await indexExists(pool, 'projects', 'uk_projects_name')) {
    await pool.query('ALTER TABLE projects DROP INDEX uk_projects_name');
  }
}

export async function ensureAssetWorkspaceSchema(pool) {
  const connection = await pool.getConnection();
  try {
    const [locks] = await connection.query(
      "SELECT GET_LOCK('storyboard_asset_workspace_schema', 30) AS acquired",
    );
    if (Number(locks[0]?.acquired) !== 1) {
      throw new Error('asset workspace schema migration lock timeout');
    }

    await addColumnIfMissing(connection, 'projects', 'user_id', 'BIGINT UNSIGNED NULL AFTER id');
    await addColumnIfMissing(
      connection,
      'characters',
      'source_personal_asset_id',
      'BIGINT UNSIGNED NULL AFTER project_id',
    );
    await addColumnIfMissing(
      connection,
      'assets',
      'source_personal_asset_id',
      'BIGINT UNSIGNED NULL AFTER project_id',
    );
    await addColumnIfMissing(
      connection,
      'characters',
      'design_sheet_status',
      "VARCHAR(32) NOT NULL DEFAULT 'idle' AFTER design_sheet_url",
    );
    await addColumnIfMissing(
      connection,
      'characters',
      'design_sheet_error',
      'TEXT NULL AFTER design_sheet_status',
    );
    await addColumnIfMissing(
      connection,
      'characters',
      'voice_reference_status',
      "VARCHAR(32) NOT NULL DEFAULT 'idle' AFTER voice_reference_duration",
    );
    await addColumnIfMissing(
      connection,
      'characters',
      'voice_reference_error',
      'TEXT NULL AFTER voice_reference_status',
    );
    await addColumnIfMissing(
      connection,
      'assets',
      'cover_status',
      "VARCHAR(32) NOT NULL DEFAULT 'idle' AFTER cover_url",
    );
    await addColumnIfMissing(
      connection,
      'assets',
      'cover_error',
      'TEXT NULL AFTER cover_status',
    );

    await connection.query(`
    CREATE TABLE IF NOT EXISTS personal_assets (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      kind VARCHAR(32) NOT NULL,
      name VARCHAR(191) NOT NULL,
      description TEXT NULL,
      file_url TEXT NULL,
      preview_url TEXT NULL,
      metadata_json LONGTEXT NULL,
      source_project_id BIGINT UNSIGNED NULL,
      source_entity_type VARCHAR(32) NULL,
      source_entity_id BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      PRIMARY KEY (id),
      KEY idx_personal_assets_user_kind (user_id, kind),
      KEY idx_personal_assets_source (source_project_id, source_entity_type, source_entity_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    await connection.query(`
    CREATE TABLE IF NOT EXISTS asset_requirements (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      project_id BIGINT UNSIGNED NOT NULL,
      chapter_id BIGINT UNSIGNED NOT NULL,
      kind VARCHAR(32) NOT NULL,
      name VARCHAR(191) NOT NULL,
      description TEXT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      linked_entity_type VARCHAR(32) NULL,
      linked_entity_id BIGINT UNSIGNED NULL,
      source_count INT NOT NULL DEFAULT 1,
      error_message TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      PRIMARY KEY (id),
      KEY idx_asset_requirements_project_chapter (project_id, chapter_id),
      KEY idx_asset_requirements_entity (linked_entity_type, linked_entity_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    await connection.query(`
    CREATE TABLE IF NOT EXISTS asset_versions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      owner_user_id BIGINT UNSIGNED NOT NULL,
      scope_type VARCHAR(32) NOT NULL DEFAULT 'project',
      entity_type VARCHAR(32) NOT NULL,
      entity_id BIGINT UNSIGNED NOT NULL,
      file_url TEXT NOT NULL,
      preview_url TEXT NULL,
      model VARCHAR(64) NOT NULL DEFAULT 'seedream-4.5',
      prompt LONGTEXT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'succeeded',
      is_current TINYINT(1) NOT NULL DEFAULT 0,
      source_type VARCHAR(32) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      PRIMARY KEY (id),
      KEY idx_asset_versions_entity (entity_type, entity_id, created_at),
      KEY idx_asset_versions_owner (owner_user_id, scope_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    await connection.query(`
    CREATE TABLE IF NOT EXISTS character_voice_versions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      owner_user_id BIGINT UNSIGNED NOT NULL,
      character_id BIGINT UNSIGNED NOT NULL,
      file_url TEXT NOT NULL,
      duration DECIMAL(8,3) NULL,
      voice_name VARCHAR(191) NULL,
      user_prompt TEXT NULL,
      effective_prompt LONGTEXT NULL,
      reference_text TEXT NULL,
      source_type VARCHAR(32) NOT NULL DEFAULT 'generated',
      status VARCHAR(32) NOT NULL DEFAULT 'succeeded',
      is_current TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      PRIMARY KEY (id),
      KEY idx_character_voice_versions_character (character_id, created_at),
      KEY idx_character_voice_versions_owner (owner_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    const [users] = await connection.query(
      'SELECT id FROM auth_users WHERE is_active = 1 ORDER BY id LIMIT 1',
    );
    if (users.length) {
      await connection.execute('UPDATE projects SET user_id = ? WHERE user_id IS NULL', [
        users[0].id,
      ]);
    }
    await connection.execute(
      "UPDATE characters SET design_sheet_status = 'succeeded' WHERE design_sheet_url <> '' AND design_sheet_status = 'idle'",
    );
    await connection.execute(
      "UPDATE characters SET voice_reference_status = 'succeeded' WHERE voice_reference_url <> '' AND voice_reference_status = 'idle'",
    );
    await connection.execute(
      "UPDATE assets SET cover_status = 'succeeded' WHERE cover_url <> '' AND cover_status = 'idle'",
    );
    await connection.execute(`
      INSERT INTO asset_versions
      (owner_user_id, scope_type, entity_type, entity_id, file_url, preview_url,
       model, prompt, status, is_current, source_type)
      SELECT p.user_id, 'project', 'character', c.id, c.design_sheet_url, c.avatar_url,
             'legacy', '', 'succeeded', 1, 'legacy-import'
      FROM characters c
      JOIN projects p ON p.id = c.project_id
      WHERE c.deleted_at IS NULL AND c.design_sheet_url <> '' AND p.user_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM asset_versions av
          WHERE av.entity_type = 'character' AND av.entity_id = c.id AND av.deleted_at IS NULL
        )
    `);
    await connection.execute(`
      INSERT INTO character_voice_versions
      (owner_user_id, character_id, file_url, duration, voice_name, user_prompt,
       effective_prompt, reference_text, source_type, status, is_current)
      SELECT p.user_id, c.id, c.voice_reference_url, c.voice_reference_duration, c.voice_name,
             c.voice_prompt, '', c.voice_reference_text, 'legacy-import', 'succeeded', 1
      FROM characters c
      JOIN projects p ON p.id = c.project_id
      WHERE c.deleted_at IS NULL AND c.voice_reference_url <> '' AND p.user_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM character_voice_versions cv
          WHERE cv.character_id = c.id AND cv.deleted_at IS NULL
        )
    `);
    await ensureProjectNameConstraint(connection);
  } finally {
    await connection
      .query("SELECT RELEASE_LOCK('storyboard_asset_workspace_schema')")
      .catch(() => null);
    connection.release();
  }
}
