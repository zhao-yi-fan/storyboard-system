import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { describe, it } from 'mocha';

const cjsRequire = createRequire(import.meta.url);
const MediaRedirectController = cjsRequire('../app/controller/media_redirect');
const { generatedObjectKey } = cjsRequire('../app/lib/generated_asset');

function createContext(objectKey: string) {
  const headers = new Map<string, string>();
  const context = {
    params: { objectKey },
    status: 200,
    body: undefined as unknown,
    location: '',
    set(name: string, value: string) {
      headers.set(name, value);
    },
    redirect(url: string) {
      this.location = url;
      this.status = 302;
    },
  };
  return { context, headers };
}

const app = {
  config: {
    storyboard: {
      generatedAssetBasePath: '/generated',
      aliyunOssEndpoint: 'oss-cn-beijing-internal.aliyuncs.com',
      aliyunOssPublicEndpoint: 'oss-cn-beijing.aliyuncs.com',
      aliyunOssAccessKeyId: 'test-access-key',
      aliyunOssAccessKeySecret: 'test-access-secret',
      aliyunOssBucket: 'storyboard-test',
    },
  },
};

describe('test/media_redirect.test.ts', () => {
  it('returns a retryable error when OSS streaming is unavailable', async () => {
    const { context } = createContext('scene-covers/cover.png');
    await MediaRedirectController.prototype.stream.call({ app: { config: { storyboard: {} } }, ctx: context });

    assert.equal(context.status, 503);
  });

  it('rejects traversal object keys', async () => {
    const { context } = createContext('../secrets.txt');
    await MediaRedirectController.prototype.stream.call({ app, ctx: context });

    assert.equal(context.status, 404);
    assert.equal(context.body, 'Not Found');
  });

  it('rejects traversal in generated path normalization', () => {
    assert.throws(() => generatedObjectKey(app, '/generated/scene-covers/../secrets.txt'));
  });
});
