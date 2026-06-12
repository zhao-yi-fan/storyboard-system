'use strict';

import { hashPassword } from './auth_crypto';

type PoolLike = {
  query: (sql: string, params?: unknown[]) => Promise<[ any[], unknown ]>;
  execute: (sql: string, params?: unknown[]) => Promise<[ any, unknown ]>;
};

type AuthConfig = {
  bootstrapAccount: string;
  bootstrapPassword: string;
  bootstrapDisplayName: string;
  bootstrapRoleLabel: string;
};

export async function ensureAuthSchema(pool: PoolLike) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      account VARCHAR(191) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      password_salt VARCHAR(255) NOT NULL,
      display_name VARCHAR(191) NOT NULL,
      role_label VARCHAR(191) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      last_login_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_auth_users_account (account)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      session_token_hash VARCHAR(255) NOT NULL,
      expires_at DATETIME NOT NULL,
      last_seen_at DATETIME NULL,
      user_agent VARCHAR(512) NOT NULL DEFAULT '',
      ip_address VARCHAR(128) NOT NULL DEFAULT '',
      revoked_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_auth_sessions_token_hash (session_token_hash),
      KEY idx_auth_sessions_user_id (user_id),
      KEY idx_auth_sessions_expires_at (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function ensureBootstrapAuthUser(pool: PoolLike, authConfig: AuthConfig) {
  const account = String(authConfig.bootstrapAccount || '').trim();
  const password = String(authConfig.bootstrapPassword || '').trim();
  if (!account || !password) {
    return;
  }

  const displayName = String(authConfig.bootstrapDisplayName || '').trim() || '创作者';
  const roleLabel = String(authConfig.bootstrapRoleLabel || '').trim() || '分镜工作室';
  const passwordInfo = await hashPassword(password);
  const [ rows ] = await pool.query(
    'SELECT id FROM auth_users WHERE account = ? LIMIT 1',
    [ account ],
  );

  if (rows.length) {
    await pool.execute(
      `UPDATE auth_users
       SET password_hash = ?, password_salt = ?, display_name = ?, role_label = ?, is_active = 1
       WHERE account = ?`,
      [ passwordInfo.hash, passwordInfo.salt, displayName, roleLabel, account ],
    );
    return;
  }

  await pool.execute(
    `INSERT INTO auth_users (account, password_hash, password_salt, display_name, role_label, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [ account, passwordInfo.hash, passwordInfo.salt, displayName, roleLabel ],
  );
}
