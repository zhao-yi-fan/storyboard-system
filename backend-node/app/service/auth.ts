'use strict';

const { Service } = require('egg');
const {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} = require('../lib/auth_crypto');

type MysqlPool = {
  query: (sql: string, params?: unknown[]) => Promise<[any[], any[]]>;
  execute: (sql: string, params?: unknown[]) => Promise<any>;
};

type AuthConfig = {
  sessionCookieName?: string;
  sessionTtlDays?: number;
};

type AuthUserRow = {
  id: number;
  account: string;
  password_hash: string;
  password_salt: string;
  display_name: string;
  role_label: string;
  is_active: boolean | number;
  last_login_at: unknown;
  created_at: unknown;
  updated_at: unknown;
};

type AuthUser = {
  id: number;
  account: string;
  display_name: string;
  role_label: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string | null;
  updated_at: string | null;
} | null;

type SessionInfo = {
  id: number;
  user_id?: number;
  expires_at: string | null;
  last_seen_at: string | null;
};

type RequestMeta = {
  userAgent?: string;
  ipAddress?: string;
};

function mapAuthUser(row: AuthUserRow | undefined | null): AuthUser {
  if (!row) {
    return null;
  }
  return {
    id: Number(row.id),
    account: String(row.account || ''),
    display_name: String(row.display_name || ''),
    role_label: String(row.role_label || ''),
    is_active: Boolean(row.is_active),
    last_login_at: row.last_login_at
      ? new Date(row.last_login_at as string | number).toISOString()
      : null,
    created_at: row.created_at ? new Date(row.created_at as string | number).toISOString() : null,
    updated_at: row.updated_at ? new Date(row.updated_at as string | number).toISOString() : null,
  };
}

class AuthService extends Service {
  get pool(): MysqlPool {
    return this.app.mysqlPool;
  }

  get authConfig(): AuthConfig {
    return this.app.config.auth || {};
  }

  get sessionCookieName(): string {
    return this.authConfig.sessionCookieName || 'storyboard_session';
  }

  get sessionTtlDays(): number {
    const ttl = Number(this.authConfig.sessionTtlDays || 14);
    return Number.isFinite(ttl) && ttl > 0 ? ttl : 14;
  }

  buildCookieOptions(expiresAt: Date) {
    return {
      httpOnly: true,
      sameSite: 'lax',
      overwrite: true,
      expires: expiresAt,
    };
  }

  async findUserByAccount(account: string): Promise<AuthUserRow | null> {
    const [rows] = await this.pool.query(
      `SELECT id, account, password_hash, password_salt, display_name, role_label, is_active, last_login_at, created_at, updated_at
       FROM auth_users
       WHERE account = ?
       LIMIT 1`,
      [account],
    );
    return rows[0] || null;
  }

  async findUserById(id: number | string): Promise<AuthUserRow | null> {
    const [rows] = await this.pool.query(
      `SELECT id, account, password_hash, password_salt, display_name, role_label, is_active, last_login_at, created_at, updated_at
       FROM auth_users
       WHERE id = ?
       LIMIT 1`,
      [id],
    );
    return rows[0] || null;
  }

  async createUser(payload: {
    account?: string;
    password?: string;
    display_name?: string;
    role_label?: string;
  }): Promise<AuthUser> {
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
    const [result] = await this.pool.execute(
      `INSERT INTO auth_users (account, password_hash, password_salt, display_name, role_label, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [account, passwordInfo.hash, passwordInfo.salt, displayName, roleLabel],
    );

    const created = await this.findUserById(result.insertId);
    return mapAuthUser(created);
  }

  async login(
    account: unknown,
    password: unknown,
    requestMeta: RequestMeta,
  ): Promise<{ user: AuthUser; session: SessionInfo; sessionToken: string; expiresAt: Date }> {
    const normalizedAccount = String(account || '').trim();
    const normalizedPassword = String(password || '').trim();
    if (!normalizedAccount || !normalizedPassword) {
      throw new Error('请输入账号和密码');
    }

    const user = await this.findUserByAccount(normalizedAccount);
    if (!user || !user.is_active) {
      throw new Error('账号或密码错误');
    }

    const isValid = await verifyPassword(
      normalizedPassword,
      user.password_salt,
      user.password_hash,
    );
    if (!isValid) {
      throw new Error('账号或密码错误');
    }

    const sessionToken = generateSessionToken();
    const sessionTokenHash = hashSessionToken(sessionToken);
    const expiresAt = new Date(Date.now() + this.sessionTtlDays * 24 * 60 * 60 * 1000);

    await this.pool.execute(
      'UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
      [user.id],
    );
    const [result] = await this.pool.execute(
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

    await this.pool.execute('UPDATE auth_users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    const nextUser = await this.findUserById(user.id);
    return {
      user: mapAuthUser(nextUser),
      session: {
        id: result.insertId,
        expires_at: expiresAt.toISOString(),
        last_seen_at: null,
      },
      sessionToken,
      expiresAt,
    };
  }

  async getCurrentUserByToken(
    token: unknown,
  ): Promise<{ user: AuthUser; session: SessionInfo } | null> {
    const sessionTokenHash = hashSessionToken(String(token || ''));
    const [rows] = await this.pool.query(
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
      [sessionTokenHash],
    );

    const row = rows[0] as Record<string, any> | undefined;
    if (!row) {
      return null;
    }

    return {
      user: mapAuthUser(row as AuthUserRow),
      session: {
        id: Number(row.session_id),
        user_id: Number(row.user_id),
        expires_at: row.expires_at
          ? new Date(row.expires_at as string | number).toISOString()
          : null,
        last_seen_at: row.last_seen_at
          ? new Date(row.last_seen_at as string | number).toISOString()
          : null,
      },
    };
  }

  async touchSession(sessionId: number | string): Promise<void> {
    await this.pool.execute('UPDATE auth_sessions SET last_seen_at = NOW() WHERE id = ?', [
      sessionId,
    ]);
  }

  async revokeSessionByToken(token: unknown): Promise<void> {
    const normalizedToken = String(token || '').trim();
    if (!normalizedToken) {
      return;
    }
    await this.pool.execute(
      'UPDATE auth_sessions SET revoked_at = NOW() WHERE session_token_hash = ? AND revoked_at IS NULL',
      [hashSessionToken(normalizedToken)],
    );
  }
}

module.exports = AuthService;
