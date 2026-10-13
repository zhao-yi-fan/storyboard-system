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
      assert.ok(Number(url.searchParams.get('Expires')) >= Date.now() / 1000 + 3590);
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
