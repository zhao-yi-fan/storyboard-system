'use strict';

const Controller = require('egg').Controller;
const response = require('../lib/response');

class AuthController extends Controller {
  get sessionCookieName() {
    return this.ctx.app.config.auth?.sessionCookieName || 'storyboard_session';
  }

  buildRequestMeta() {
    return {
      userAgent: this.ctx.get('user-agent'),
      ipAddress: this.ctx.ip,
    };
  }

  async login() {
    const { account = '', password = '' } = this.ctx.request.body || {};

    try {
      const result = await this.ctx.service.auth.login(account, password, this.buildRequestMeta());
      this.ctx.cookies.set(
        this.sessionCookieName,
        result.sessionToken,
        this.ctx.service.auth.buildCookieOptions(result.expiresAt),
      );
      response.success(this.ctx, result.user);
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  /**
   * 账号密码登录并创建会话。
   * @returns {Promise<void>} 返回当前用户，并通过 HttpOnly Cookie 持久化会话。
   * @example
   * POST /api/auth/login { "account": "admin", "password": "123456" }
   * // => { code: 200, data: { id: 1, account: "admin" }, message: "" }
   */
  async logout() {
    try {
      const sessionToken = this.ctx.cookies.get(this.sessionCookieName);
      if (sessionToken) {
        await this.ctx.service.auth.revokeSessionByToken(sessionToken);
      }
      this.ctx.cookies.set(this.sessionCookieName, '', {
        httpOnly: true,
        overwrite: true,
        expires: new Date(0),
      });
      response.success(this.ctx, { success: true });
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }

  /**
   * 退出当前登录会话。
   * @returns {Promise<void>} 返回成功标记并删除 Cookie。
   * @example
   * POST /api/auth/logout
   * // => { code: 200, data: { success: true }, message: "" }
   */
  async me() {
    const currentUser = this.ctx.state.currentUser;
    if (!currentUser) {
      response.error(this.ctx, '请先登录');
      return;
    }
    response.success(this.ctx, currentUser);
  }

  /**
   * 读取当前登录用户。
   * @returns {Promise<void>} 返回当前用户信息。
   * @example
   * GET /api/auth/me
   * // => { code: 200, data: { id: 1, account: "admin" }, message: "" }
   */
}

module.exports = AuthController;
