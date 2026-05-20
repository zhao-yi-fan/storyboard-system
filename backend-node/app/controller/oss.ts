'use strict';

const Controller = require('egg').Controller;
const response = require('../lib/response');

class OssController extends Controller {
  async sign() {
    try {
      const result = await this.ctx.service.oss.signUploadURL(
        String(this.ctx.query.filename || ''),
        String(this.ctx.query.content_type || '')
      );
      response.success(this.ctx, result);
    } catch (err: any) {
      response.error(this.ctx, err.message);
    }
  }
}

module.exports = OssController;
