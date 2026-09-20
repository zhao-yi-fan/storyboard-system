import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { describe, it } from 'mocha';

const cjsRequire = createRequire(import.meta.url);
const { GENERATION_STATUS, MEDIA_TYPE } = cjsRequire('../app/lib/domain_constants');
const {
  VideoTimeoutError,
  isVideoTimeoutError,
} = cjsRequire('../app/lib/ai_clients');
const SceneVideoService = cjsRequire('../app/service/scene_video');

function buildSceneVideoService(overrides: {
  scene?: unknown;
  generations?: unknown[];
  generationById?: unknown;
}) {
  const service = Object.create(SceneVideoService.prototype);
  service.app = {};
  service.ctx = {
    service: {
      scene: {
        findById: async () => overrides.scene ?? null,
        update: async () => ({}),
      },
      sceneMediaGeneration: {
        findById: async () => overrides.generationById ?? null,
        listBySceneId: async () => overrides.generations ?? [],
        update: async () => ({}),
      },
      storyboardReference: {
        isSeedanceVideoModel: () => false,
      },
    },
  };
  return service;
}

describe('test/video_timeout_resume.test.ts', () => {
  it('exposes a resumable timeout status distinct from failure', () => {
    assert.equal(GENERATION_STATUS.TIMEOUT, 'timeout');
    assert.notEqual(GENERATION_STATUS.TIMEOUT, GENERATION_STATUS.FAILED);
  });

  it('marks timeout errors with code and provider task id', () => {
    const error = new VideoTimeoutError('超时', 'task-123');
    assert.equal(error.code, 'VIDEO_TIMEOUT');
    assert.equal(error.taskId, 'task-123');
    assert.match(error.message, /超时/);
    assert.ok(isVideoTimeoutError(error));
    assert.ok(isVideoTimeoutError({ code: 'VIDEO_TIMEOUT' }));
    assert.equal(isVideoTimeoutError(new Error('boom')), false);
    assert.equal(isVideoTimeoutError(null), false);
  });

  it('refuses to resume when the scene does not exist', async () => {
    const service = buildSceneVideoService({ scene: null });
    await assert.rejects(() => service.resumeVideoGeneration(21), /scene not found/);
  });

  it('refuses to resume when no video generation exists', async () => {
    const service = buildSceneVideoService({ scene: { id: 21 }, generations: [] });
    await assert.rejects(() => service.resumeVideoGeneration(21), /没有可继续等待的视频任务/);
  });

  it('returns the current scene when background polling is still running', async () => {
    const scene = { id: 21 };
    const generation = {
      id: 88,
      media_type: MEDIA_TYPE.VIDEO,
      model: 'wan2.7-i2v',
      status: GENERATION_STATUS.GENERATING,
    };
    const service = buildSceneVideoService({ scene, generationById: generation });
    const result = await service.resumeVideoGeneration(21, 88);
    assert.equal(result.resumed, false);
    assert.equal(result.scene, scene);
  });

  it('refuses to resume generations outside the timeout state', async () => {
    const service = buildSceneVideoService({
      scene: { id: 21 },
      generationById: {
        id: 88,
        media_type: MEDIA_TYPE.VIDEO,
        model: 'wan2.7-i2v',
        status: GENERATION_STATUS.FAILED,
      },
    });
    await assert.rejects(() => service.resumeVideoGeneration(21, 88), /不在可继续等待状态/);
  });

  it('refuses to resume timeout records without a provider task id', async () => {
    const service = buildSceneVideoService({
      scene: { id: 21 },
      generationById: {
        id: 88,
        media_type: MEDIA_TYPE.VIDEO,
        model: 'wan2.7-i2v',
        status: GENERATION_STATUS.TIMEOUT,
        meta_json: JSON.stringify({}),
      },
    });
    await assert.rejects(
      () => service.resumeVideoGeneration(21, 88),
      /缺少云端任务 ID/,
    );
  });
});
