import assert from 'node:assert/strict';

import { describe, it } from 'mocha';

import * as OssServiceNamespace from '../app/service/oss';

const OssService: any =
  (OssServiceNamespace as { default?: { prototype: object } }).default || OssServiceNamespace;

const OSS_CONFIG = {
  aliyunOssEndpoint: 'oss-cn-shanghai.aliyuncs.com',
  aliyunOssPublicEndpoint: 'oss-cn-shanghai.aliyuncs.com',
  aliyunOssAccessKeyId: 'test-id',
  aliyunOssAccessKeySecret: 'test-secret',
  aliyunOssBucket: 'test-bucket',
  publicAppBaseUrl: '',
};

function makeService() {
  const service = Object.create(OssService.prototype);
  Object.defineProperty(service, 'app', {
    value: { config: { storyboard: OSS_CONFIG } },
  });
  return service;
}

describe('test/oss.test.ts', () => {
  it('rejects empty filenames', async () => {
    const service = makeService();
    await assert.rejects(service.signUploadURL('', 'image/png'), /filename is required/);
  });

  it('signs upload URLs offline', async () => {
    const service = makeService();
    const result = await service.signUploadURL('/assets/demo.png', 'image/png');
    assert.equal(result.object_key, 'assets/demo.png');
    assert.ok(result.upload_url.includes('test-bucket'));
    assert.ok(result.upload_url.startsWith('https://'));
  });

  it('builds clients without network access', () => {
    const service = makeService();
    assert.ok(service.buildClient());
    assert.ok(service.buildPublicClient());
  });
});
