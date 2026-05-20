'use strict';

const Controller = require('egg').Controller;
const response = require('../lib/response');

class OssController extends Controller {
  async sign() {
    try {
      const result = await this.ctx.service.oss.signUploadURL(
        this.ctx.query.filename,
        this.ctx.query.content_type
      );
      response.success(this.ctx, result);
    } catch (err) {
      response.error(this.ctx, err.message);
    }
  }
}

module.exports = OssController;
