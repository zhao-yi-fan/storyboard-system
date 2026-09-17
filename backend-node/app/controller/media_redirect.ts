'use strict';

import { Controller } from 'egg';

const {
  generatedObjectKey,
  isOssEnabled,
  resolveGeneratedUrl,
} = require('../lib/generated_asset');

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
  async redirect() {
    const objectKey = decodeObjectKey(this.ctx.params.objectKey);
    const generatedPath = `/generated/${objectKey.replace(/^\/+/, '')}`;

    try {
      generatedObjectKey(this.app, generatedPath);
      if (!isOssEnabled(this.app)) {
        throw new Error('OSS is not configured');
      }

      this.ctx.set('Cache-Control', 'private, no-store, max-age=0');
      this.ctx.status = 302;
      this.ctx.redirect(resolveGeneratedUrl(this.app, generatedPath));
    } catch {
      this.ctx.status = 404;
      this.ctx.body = 'Not Found';
    }
  }
}

module.exports = MediaRedirectController;
