'use strict';

import { Controller } from 'egg';

const { generatedObjectKey, isOssEnabled, createOssClient } = require('../lib/generated_asset');

function decodeObjectKey(value: unknown): string {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return '';
  }
}

class MediaRedirectController extends Controller {
  /**
   * Redirects legacy stable media paths to a short-lived OSS URL.
   * This endpoint is intentionally outside /api so media requests do not require a session.
   */
  async stream() {
    const objectKey = decodeObjectKey(this.ctx.params.objectKey);
    const generatedPath = `/generated/${objectKey.replace(/^\/+/, '')}`;

    let key: string;
    try {
      key = generatedObjectKey(this.app, generatedPath);
    } catch {
      this.ctx.status = 404;
      this.ctx.body = 'Not Found';
      return;
    }

    try {
      if (!isOssEnabled(this.app)) throw new Error('OSS is not configured');
      const options = this.ctx.get('range') ? { headers: { Range: this.ctx.get('range') } } : {};
      const result = await createOssClient(this.app).getStream(key, options);
      for (const name of [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'etag',
        'last-modified',
      ]) {
        const value = result.res.headers[name];
        if (value) this.ctx.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
      // 生成物文件名自带时间戳、内容不可变：允许浏览器与 CDN 长缓存。
      this.ctx.set('Cache-Control', 'public, max-age=31536000, immutable');
      this.ctx.status = result.res.status;
      this.ctx.body = result.stream;
    } catch (error: unknown) {
      this.ctx.status = (error as { code?: string })?.code === 'NoSuchKey' ? 404 : 503;
      this.ctx.body = 'Not Found';
    }
  }
}

module.exports = MediaRedirectController;
