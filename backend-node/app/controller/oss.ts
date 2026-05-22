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

  async upload() {
    let stream;
    try {
      stream = await this.ctx.getFileStream();
      const result = await this.ctx.service.oss.uploadStream(
        stream,
        String(stream.filename || ''),
        String(stream.mimeType || stream.mime || '')
      );
      response.success(this.ctx, result);
    } catch (err: any) {
      if (stream && !stream.readableEnded) {
        stream.resume();
      }
      response.error(this.ctx, err.message);
    }
  }
}

module.exports = OssController;
