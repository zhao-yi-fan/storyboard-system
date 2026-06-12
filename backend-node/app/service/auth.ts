'use strict';
// @ts-nocheck

const { Service } = require('egg');
const { generateSessionToken, hashPassword, hashSessionToken, verifyPassword } = require('../lib/auth_crypto');

function mapAuthUser(row) {
  if (!row) {
    return null;
  }
  return {
    id: Number(row.id),
    account: String(row.account || ''),
    display_name: String(row.display_name || ''),
    role_label: String(row.role_label || ''),
    is_active: Boolean(row.is_active),
    last_login_at: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

class AuthService extends Service {
  get pool() {
    return this.app.mysqlPool;
  }

  get authConfig() {
    return this.app.config.auth || {};
  }

  get sessionCookieName() {
    return this.authConfig.sessionCookieName || 'storyboard_session';
  }

  get sessionTtlDays() {
    const ttl = Number(this.authConfig.sessionTtlDays || 14);
    return Number.isFinite(ttl) && ttl > 0 ? ttl : 14;
  }

  buildCookieOptions(expiresAt) {
    return {
      httpOnly: true,
      sameSite: 'lax',
      overwrite: true,
      expires: expiresAt,
    };
  }

  async findUserByAccount(account) {
    const [ rows ] = await this.pool.query(
      `SELECT id, account, password_hash, password_salt, display_name, role_label, is_active, last_login_at, created_at, updated_at
       FROM auth_users
       WHERE account = ?
       LIMIT 1`,
      [ account ],
    );
    return rows[0] || null;
  }

  async findUserById(id) {
    const [ rows ] = await this.pool.query(
      `SELECT id, account, password_hash, password_salt, display_name, role_label, is_active, last_login_at, created_at, updated_at
       FROM auth_users
       WHERE id = ?
       LIMIT 1`,
      [ id ],
    );
    return rows[0] || null;
  }

  async createUser(payload) {
    const account = String(payload.account || '').trim();
    const password = String(payload.password || '').trim();
    const displayName = String(payload.display_name || '').trim() || account;
    const roleLabel = String(payload.role_label || '').trim() || '分镜工作室';

    if (!account || !password) {
      throw new Error('账号和密码不能为空');
    }

    const existing = await this.findUserByAccount(account);
    if (existing) {
      throw new Error('账号已存在');
    }

    const passwordInfo = await hashPassword(password);
    const [ result ] = await this.pool.execute(
      `INSERT INTO auth_users (account, password_hash, password_salt, display_name, role_label, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [ account, passwordInfo.hash, passwordInfo.salt, displayName, roleLabel ],
    );

    const created = await this.findUserById(result.insertId);
    return mapAuthUser(created);
  }

  async login(account, password, requestMeta) {
    const normalizedAccount = String(account || '').trim();
    const normalizedPassword = String(password || '').trim();
    if (!normalizedAccount || !normalizedPassword) {
      throw new Error('请输入账号和密码');
    }

    const user = await this.findUserByAccount(normalizedAccount);
    if (!user || !user.is_active) {
      throw new Error('账号或密码错误');
    }

    const isValid = await verifyPassword(normalizedPassword, user.password_salt, user.password_hash);
    if (!isValid) {
      throw new Error('账号或密码错误');
    }

    const sessionToken = generateSessionToken();
    const sessionTokenHash = hashSessionToken(sessionToken);
    const expiresAt = new Date(Date.now() + this.sessionTtlDays * 24 * 60 * 60 * 1000);

    await this.pool.execute(
      'UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
      [ user.id ],
    );
    const [ result ] = await this.pool.execute(
      `INSERT INTO auth_sessions (user_id, session_token_hash, expires_at, last_seen_at, user_agent, ip_address)
       VALUES (?, ?, ?, NOW(), ?, ?)`,
      [
        user.id,
        sessionTokenHash,
        expiresAt,
        String(requestMeta.userAgent || ''),
        String(requestMeta.ipAddress || ''),
      ],
    );

    await this.pool.execute(
      'UPDATE auth_users SET last_login_at = NOW() WHERE id = ?',
      [ user.id ],
    );

    const nextUser = await this.findUserById(user.id);
    return {
      user: mapAuthUser(nextUser),
      session: {
        id: result.insertId,
        expires_at: expiresAt.toISOString(),
      },
      sessionToken,
      expiresAt,
    };
  }

  async getCurrentUserByToken(token) {
    const sessionTokenHash = hashSessionToken(String(token || ''));
    const [ rows ] = await this.pool.query(
      `SELECT
         s.id AS session_id,
         s.user_id,
         s.expires_at,
         s.last_seen_at,
         u.id,
         u.account,
         u.password_hash,
         u.password_salt,
         u.display_name,
         u.role_label,
         u.is_active,
         u.last_login_at,
         u.created_at,
         u.updated_at
       FROM auth_sessions s
       INNER JOIN auth_users u ON u.id = s.user_id
       WHERE s.session_token_hash = ?
         AND s.revoked_at IS NULL
         AND s.expires_at > NOW()
         AND u.is_active = 1
       LIMIT 1`,
      [ sessionTokenHash ],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      user: mapAuthUser(row),
      session: {
        id: Number(row.session_id),
        user_id: Number(row.user_id),
        expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null,
        last_seen_at: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : null,
      },
    };
  }

  async touchSession(sessionId) {
    await this.pool.execute(
      'UPDATE auth_sessions SET last_seen_at = NOW() WHERE id = ?',
      [ sessionId ],
    );
  }

  async revokeSessionByToken(token) {
    const normalizedToken = String(token || '').trim();
    if (!normalizedToken) {
      return;
    }
    await this.pool.execute(
      'UPDATE auth_sessions SET revoked_at = NOW() WHERE session_token_hash = ? AND revoked_at IS NULL',
      [ hashSessionToken(normalizedToken) ],
    );
  }
}

module.exports = AuthService;
