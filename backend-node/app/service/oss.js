'use strict';

const Service = require('egg').Service;
const { createOssClient, generatedPublicPath } = require('../lib/generated_asset');

class OssService extends Service {
  buildClient() {
    return createOssClient(this.app, false);
  }

  async signUploadURL(fileName, contentType) {
    if (!fileName) {
      throw new Error('filename is required');
    }
    const client = this.buildClient();
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
}

module.exports = OssService;
