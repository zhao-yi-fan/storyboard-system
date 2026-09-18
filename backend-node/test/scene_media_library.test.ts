import assert from 'node:assert/strict';

import { describe, it } from 'mocha';

import * as SceneMediaLibraryServiceNamespace from '../app/service/scene_media_library';

const SceneMediaLibraryService: any =
  (SceneMediaLibraryServiceNamespace as { default?: { prototype: object } }).default ||
  SceneMediaLibraryServiceNamespace;

const COVER_GENERATION = {
  id: 5,
  scene_id: 21,
  media_type: 'cover',
  status: 'succeeded',
  result_url: '/generated/cover.png',
  preview_url: '',
  error_message: '',
};

function makeService(findGeneration?: () => Promise<unknown>) {
  const calls: Array<{ service: string; method: string; args: unknown[] }> = [];
  const stub = (service: string, methods: Record<string, (...args: never[]) => unknown>) => {
    const target: Record<string, unknown> = {};
    for (const [method, impl] of Object.entries(methods)) {
      target[method] = async (...args: never[]) => {
        calls.push({ service, method, args });
        return impl(...args);
      };
    }
    return target;
  };
  const service = Object.create(SceneMediaLibraryService.prototype);
  Object.defineProperty(service, 'ctx', {
    value: {
      service: {
        scene: stub('scene', {
          findById: async () => ({ id: 21 }),
          update: async () => ({ id: 21 }),
        }),
        sceneMediaGeneration: stub('sceneMediaGeneration', {
          findById: findGeneration || (async () => ({ ...COVER_GENERATION })),
          listBySceneId: async () => [],
          markCurrent: async () => undefined,
          softDelete: async () => undefined,
        }),
        sceneVideoFrame: stub('sceneVideoFrame', {
          attachToGenerations: async (generations: unknown) => generations,
        }),
        sceneVideoPoster: stub('sceneVideoPoster', {
          ensureBestEffort: async () => '/generated/poster.png',
        }),
      },
    },
  });
  Object.defineProperty(service, 'app', {
    value: { config: { storyboard: { publicAppBaseUrl: '' } } },
  });
  return { service, calls };
}

describe('test/scene_media_library.test.ts', () => {
  it('rejects mismatched generations on apply', async () => {
    const { service } = makeService();
    await assert.rejects(
      service.apply(21, { ...COVER_GENERATION, scene_id: 22 }),
      /scene media generation not found/,
    );
    await assert.rejects(
      service.apply(21, { ...COVER_GENERATION, media_type: 'mystery' }),
      /unsupported media type/,
    );
  });

  it('applies cover generations to the scene', async () => {
    const { service, calls } = makeService();
    await service.apply(21, { ...COVER_GENERATION });
    const update = calls.find((call) => call.service === 'scene' && call.method === 'update');
    assert.deepEqual(update?.args, [
      21,
      { cover_url: '/generated/cover.png', cover_preview_url: '/generated/cover.png' },
    ]);
  });

  it('guards setCurrent to succeeded generations with files', async () => {
    const { service } = makeService(async () => ({ ...COVER_GENERATION, status: 'failed' }));
    await assert.rejects(service.setCurrent(21, 5), /只有生成成功/);
  });

  it('lists generations with frames attached', async () => {
    const { service, calls } = makeService();
    await service.list(21);
    assert.ok(calls.some((call) => call.method === 'attachToGenerations'));
  });
});
