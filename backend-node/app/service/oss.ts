'use strict';
// @ts-nocheck

const path = require('node:path');
const Service = require('egg').Service;
const { createOssClient, generatedPublicPath, uploadBuffer, isOssEnabled } = require('../lib/generated_asset');

class OssService extends Service {
  buildClient() {
    return createOssClient(this.app, false);
  }

  buildPublicClient() {
    return createOssClient(this.app, true);
  }

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
