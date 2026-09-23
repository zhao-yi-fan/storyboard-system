import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { describe, it } from 'mocha';

const cjsRequire = createRequire(import.meta.url);
const StoryboardReferenceService = cjsRequire('../app/service/storyboard_reference');
const { generateSeedreamImage } = cjsRequire('../app/lib/ai_clients');

const OSS_HOST = 'oss-cn-beijing.aliyuncs.com';

function ossApp() {
  return {
    config: {
      storyboard: {
        generatedAssetBasePath: '/generated',
        generatedAssetDir: '../storage',
        publicAppBaseUrl: '',
        aliyunOssEndpoint: OSS_HOST,
        aliyunOssAccessKeyId: 'test-id',
        aliyunOssAccessKeySecret: 'test-secret',
        aliyunOssBucket: 'test-bucket',
        seedreamImageApiKey: 'test-key',
        seedreamImageBaseUrl: 'https://seedream.test/api/v1',
        seedreamImageModel: 'doubao-seedream-4-5-test',
        seedreamImageRequestTimeoutSeconds: 5,
      },
    },
    logger: {},
  };
}

function referenceService(app: unknown) {
  const service = Object.create(StoryboardReferenceService.prototype);
  Object.defineProperty(service, 'app', { value: app, configurable: true });
  return service;
}

describe('test/reference_url_shape.test.ts', () => {
  it('keeps assembled reference urls same-origin even with OSS enabled', async () => {
    const service = referenceService(ossApp());
    const storyboard = {
      characters: [
        { id: 8, name: '林婉', design_sheet_url: '/generated/characters/sheet-8.png' },
      ],
      assets: [{ id: 5, name: '雨巷', type: 'scene', cover_url: '/generated/assets/bg.png' }],
    };
    const images = await service.selectReferenceImages(storyboard, {});
    assert.equal(images.references.length, 2);
    for (const item of images.references) {
      assert.ok(
        (item.url as string).startsWith('/generated/'),
        `reference url must stay same-origin: ${item.url}`,
      );
      assert.ok(!(item.url as string).includes(OSS_HOST));
    }
    const videoImages = service.selectVideoCharacterReferenceImages(storyboard);
    assert.equal(videoImages.references.length, 1);
    assert.ok((videoImages.references[0].url as string).startsWith('/generated/'));
  });

  it('signs provider-bound image urls at the Seedream entry', async () => {
    const originalFetch = globalThis.fetch;
    let requestBody: { image?: unknown } | null = null;
    const mockFetch = async (_url: string, options: RequestInit) => {
      requestBody = JSON.parse(String(options.body || '{}'));
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: [{ url: 'https://cdn.example.com/out.png' }] }),
      };
    };
    Object.assign(globalThis, { fetch: mockFetch });
    try {
      const url = await generateSeedreamImage(ossApp(), 'prompt', [
        '/generated/characters/sheet-8.png',
      ]);
      assert.equal(url, 'https://cdn.example.com/out.png');
      const sent = (requestBody?.image as string) || '';
      assert.ok(
        sent.includes(OSS_HOST),
        `provider must receive a signed url: ${sent}`,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
