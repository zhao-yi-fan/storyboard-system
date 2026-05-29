'use strict';
// @ts-nocheck

const path = require('node:path');
const Service = require('egg').Service;
const { createOssClient, generatedPublicPath, uploadBuffer, isOssEnabled } = require('../lib/generated_asset');

class OssService extends Service {
  /**
   * 创建用于内网/服务端上传的 OSS client。
   * @returns {object} OSS client 实例。
   * @example
   * service.buildClient()
   * // => OSS client
   */
  buildClient() {
    return createOssClient(this.app, false);
  }

  /**
   * 创建用于公网签名地址的 OSS client。
   * @returns {object} OSS client 实例。
   * @example
   * service.buildPublicClient()
   * // => OSS client
   */
  buildPublicClient() {
    return createOssClient(this.app, true);
  }

  /**
   * 为浏览器或外部客户端签发一个上传 URL。
   * @param {string} fileName OSS 对象路径，例如 `"assets/demo.png"`。
   * @param {string} contentType 文件类型，例如 `"image/png"`。
   * @returns {Promise<object>} 上传签名和内部 public path。
   * @example
   * await service.signUploadURL("assets/demo.png", "image/png")
   * // => { upload_url: "https://...", public_url: "/generated/assets/demo.png", object_key: "assets/demo.png" }
   */
  async signUploadURL(fileName, contentType) {
    if (!fileName) {
      throw new Error('filename is required');
    }
    const client = this.buildPublicClient();
    const objectKey = String(fileName).replace(/^\/+/, '');
    const uploadUrl = await client.signatureUrl(objectKey, {
      method: 'PUT',
      expires: 3600,
      'Content-Type': contentType || 'application/octet-stream',
    });
    return {
      upload_url: uploadUrl,
      public_url: generatedPublicPath(this.app, '', objectKey),
      object_key: objectKey,
    };
  }

  /**
   * 接收后端 multipart 流并上传到 OSS。
   * @param {AsyncIterable<Buffer>} stream 文件流，例如浏览器上传的图片流。
   * @param {string} fileName 原始文件名，例如 `"poster.png"`。
   * @param {string} contentType 文件类型，例如 `"image/png"`。
   * @returns {Promise<object>} 上传结果，包含内部 public path。
   * @example
   * await service.uploadStream(fileStream, "poster.png", "image/png")
   * // => { public_url: "/generated/assets/1710000000000-abcd.png", object_key: "assets/1710000000000-abcd.png" }
   */
  async uploadStream(stream, fileName, contentType) {
    if (!isOssEnabled(this.app)) {
      throw new Error('当前未配置文件上传服务，请先配置 OSS 上传。');
    }

    const ext = path.posix.extname(String(fileName || '').trim());
    const objectKey = `assets/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    await uploadBuffer(this.app, Buffer.concat(chunks), generatedPublicPath(this.app, '', objectKey));

    return {
      public_url: generatedPublicPath(this.app, '', objectKey),
      object_key: objectKey,
      file_name: path.posix.basename(objectKey),
      content_type: contentType || 'application/octet-stream',
    };
  }
}

module.exports = OssService;
