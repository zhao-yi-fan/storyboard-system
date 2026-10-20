import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { describe, it } from 'mocha';

// @ts-expect-error: tests execute as ESM while the app's tsc assumes CJS
const require = createRequire(import.meta.url);
const { resolveUrl, resolveSignedUrl, normalizeGeneratedAssetReference } = require('../app/lib/generated_asset');

const app = { config: { storyboard: {
  aliyunOssEndpoint: 'oss-cn-beijing-internal.aliyuncs.com',
  aliyunOssBucket: 'test-bucket',
  aliyunOssAccessKeyId: 'test-key',
  aliyunOssAccessKeySecret: 'test-secret',
} } };

describe('browser private OSS signing', () => {
  it('renews both stable keys and expired managed URLs over public HTTPS', () => {
    for (const raw of ['/generated/characters/a.png', 'https://test-bucket.oss-cn-beijing.aliyuncs.com/characters/a.png?Expires=1&Signature=expired']) {
      const url = new URL(resolveUrl(app, raw));
      assert.equal(url.origin, 'https://test-bucket.oss-cn-beijing.aliyuncs.com');
      assert.equal(url.pathname, '/characters/a.png');
      const remaining = Number(url.searchParams.get('Expires')) - Date.now() / 1000;
      assert.ok(remaining > 2390 && remaining <= 3600);
      assert.equal(url.searchParams.get('response-cache-control'), 'private, max-age=300');
      assert.notEqual(url.searchParams.get('Signature'), 'expired');
      assert.equal(normalizeGeneratedAssetReference(app, url.href), '/generated/characters/a.png');
      assert.equal(new URL(resolveSignedUrl(app, raw)).protocol, 'https:');
    }
  });
  it('keeps local static paths usable without OSS and leaves third party URLs alone', () => {
    assert.equal(resolveUrl({ config: { storyboard: {} } }, '/generated/a.png'), '/generated/a.png');
    assert.equal(resolveUrl(app, 'https://example.com/a.png'), 'https://example.com/a.png');
  });
});

describe('stable browser signing windows', () => {
  it('is identical across times, workers and historical URLs in a window, and changes at its boundary', () => {
    const originalNow = Date.now;
    const start = 1_800_000_000_000;
    const signAt = (offset: number, config = app) => {
      Date.now = () => start + offset;
      return resolveUrl(config, '/generated/characters/a.png');
    };
    try {
      const first = signAt(0);
      assert.equal(signAt(999), first);
      assert.equal(signAt(1_199_999, structuredClone(app)), first);
      assert.equal(resolveUrl(app, first), first);
      const next = signAt(1_200_000);
      assert.notEqual(next, first);
      assert.equal(Number(new URL(next).searchParams.get('Expires')) - Number(new URL(first).searchParams.get('Expires')), 1200);
      const server = new URL(resolveSignedUrl(app, first));
      assert.equal(Number(server.searchParams.get('Expires')), Math.round(Date.now() / 1000) + 3600);
      assert.equal(server.searchParams.has('response-cache-control'), false);
    } finally { Date.now = originalNow; }
  });
  it('retries SDK clock races and fails with a redacted error after three attempts', () => {
    const OSS = require('ali-oss');
    const original = OSS.prototype.signatureUrl;
    let calls = 0;
    OSS.prototype.signatureUrl = function (...args: unknown[]) {
      calls++;
      const value = new URL(original.apply(this, args));
      if (calls < 3) value.searchParams.set('Expires', '1');
      return value.href;
    };
    try {
      assert.ok(resolveUrl(app, '/generated/a.png'));
      assert.equal(calls, 3);
      calls = 0;
      OSS.prototype.signatureUrl = () => { calls++; return 'https://example.com/a?Expires=1&Signature=sensitive'; };
      assert.throws(() => resolveUrl(app, '/generated/a.png'), /^Error: Unable to generate stable browser media signature$/);
      assert.equal(calls, 3);
    } finally { OSS.prototype.signatureUrl = original; }
  });
  it('assigns fresh preview names without losing the extension', () => {
    const { versionedPreviewFilename } = require('../app/lib/media');
    const first = versionedPreviewFilename('asset-9.thumb.webp');
    assert.match(first, /^asset-9\.thumb-[a-f0-9-]+\.webp$/);
    assert.notEqual(versionedPreviewFilename('asset-9.thumb.webp'), first);
  });
  it('recovers from an actual clock tick between calculation and SDK signing', () => {
    const OSS = require('ali-oss');
    const originalSign = OSS.prototype.signatureUrl;
    const originalNow = Date.now;
    let now = 1_800_000_000_499;
    let calls = 0;
    Date.now = () => now;
    OSS.prototype.signatureUrl = function (...args: unknown[]) {
      calls++;
      if (calls === 1) now += 2;
      return originalSign.apply(this, args);
    };
    try {
      const url = new URL(resolveUrl(app, '/generated/a.png'));
      assert.equal(calls, 2);
      assert.equal(Number(url.searchParams.get('Expires')), 1_800_003_600);
    } finally {
      Date.now = originalNow;
      OSS.prototype.signatureUrl = originalSign;
    }
  });
});
