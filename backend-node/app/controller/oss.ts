'use strict';

const Controller = require('egg').Controller;
const response = require('../lib/response');

class OssController extends Controller {
  /**
   * 签发前端直传 OSS 所需的上传地址。
   * @returns {Promise<void>} 通过统一响应格式返回上传签名。
   * @example
   * GET /api/oss/sign?filename=assets/demo.png&content_type=image/png
   * // => { code: 200, data: { upload_url: "https://...", public_url: "/generated/assets/demo.png" }, message: "" }
   */
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

  /**
   * 接收 multipart 文件并由后端转传到 OSS。
   * @returns {Promise<void>} 通过统一响应格式返回上传结果。
   * @example
   * POST /api/oss/upload (multipart file=image.png)
   * // => { code: 200, data: { public_url: "/generated/assets/1710000000000-abcd.png" }, message: "" }
   */
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
