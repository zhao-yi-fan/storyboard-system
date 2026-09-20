import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { describe, it } from 'mocha';

const require = createRequire(import.meta.url);
const { normalizeGeneratedAssetReference, resolveUrl } = require('../app/lib/generated_asset');
const { sanitizeFileName } = require('../app/lib/media');

const APP = {
  baseDir: '/tmp/storyboard-test',
  config: { storyboard: { publicAppBaseUrl: 'https://cdn.example.com' } },
} as never;

describe('test/generated_asset.test.ts', () => {
  it('resolves empty values to empty strings', () => {
    assert.equal(resolveUrl(APP, ''), '');
    assert.equal(resolveUrl(APP, null), '');
    assert.equal(normalizeGeneratedAssetReference(APP, ''), '');
  });

  it('joins absolute paths with the public base url', () => {
    assert.equal(
      resolveUrl(APP, '/static/a.png', 'https://cdn.example.com/'),
      'https://cdn.example.com/static/a.png',
    );
  });

  it('passes generated paths through untouched', () => {
    assert.equal(
      resolveUrl(APP, '/generated/a.png', 'https://cdn.example.com/'),
      '/generated/a.png',
    );
  });

  it('passes through absolute http urls', () => {
    assert.equal(
      resolveUrl(APP, 'https://other.example.com/a.png'),
      'https://other.example.com/a.png',
    );
  });

  it('normalizes managed OSS hosts to public paths', () => {
    const ossApp = {
      baseDir: '/tmp/storyboard-test',
      config: {
        storyboard: {
          publicAppBaseUrl: '',
          aliyunOssEndpoint: 'oss-cn-shanghai.aliyuncs.com',
          aliyunOssBucket: 'test-bucket',
        },
      },
    } as never;
    assert.equal(
      normalizeGeneratedAssetReference(
        ossApp,
        'https://test-bucket.oss-cn-shanghai.aliyuncs.com/covers/a.png',
      ),
      '/generated/covers/a.png',
    );
  });
});

describe('test/media_utils.test.ts', () => {
  it('sanitizes filenames', () => {
    assert.equal(sanitizeFileName('a/b:c?.png'), 'a-b-c-.png');
    assert.equal(sanitizeFileName('  spaced name  '), 'spaced-name');
    assert.equal(sanitizeFileName(''), 'preview');
    assert.equal(sanitizeFileName(null), 'preview');
  });
});
