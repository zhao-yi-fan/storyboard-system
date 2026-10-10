import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const JobService = require('../app/service/local_video_job');
const auth = require('../app/middleware/local_worker_auth');
const ReferenceService = require('../app/service/storyboard_reference');
const VideoService = require('../app/service/scene_video');

function makeService(rows: any[]) {
  const service = Object.create(JobService.prototype);
  let lock = Promise.resolve();
  service.app = {
    config: {
      storyboard: {
        localWorkerOwnerId: 7,
        localWorkerKey: 'x'.repeat(32),
        localWorkerLeaseSeconds: 120,
      },
    },
  };
  // Simulates the DB transaction row lock shared by separate service instances.
  service.transaction = async (action: any) => {
    const previous = lock;
    let release: () => void = () => {};
    lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await action({
        query: async (sql: string, params: any[]) => {
          if (sql.includes('FROM scenes')) return [[{ id: params[0] }]];
          if (sql.includes("status='queued'"))
            return [
              rows.filter((r) => r.owner_id === params[0] && r.status === 'queued').slice(0, 1),
            ];
          return [rows.filter((r) => r.id === params[0] && r.owner_id === params[1])];
        },
        execute: async (sql: string, params: any[]) => {
          if (sql.includes("status='generating'"))
            Object.assign(
              rows.find((r) => r.id === params[1]),
              { status: 'generating', claim_token: params[0], heartbeat_at: new Date() },
            );
          else if (sql.includes('heartbeat_at=NOW(),status='))
            Object.assign(
              rows.find((r) => r.id === params[2]),
              { status: params[0], prompt_id: params[1], heartbeat_at: new Date() },
            );
          return [{ affectedRows: 1 }];
        },
      });
    } finally {
      release();
    }
  };
  return service;
}

describe('local worker queue', () => {
  it('only one simultaneous caller claims a queued job', async () => {
    const rows = [{ id: 1, owner_id: 7, status: 'queued', input_json: '{"duration":4}' }];
    const service = makeService(rows);
    const results = await Promise.all([service.claim(), service.claim()]);
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(results.find(Boolean).input.duration, 4);
    assert.match(results.find(Boolean).token, /^[a-f0-9]{64}$/);
  });

  it('keeps expired claimed jobs assigned and lets the original claim resume', async () => {
    const token = 'a'.repeat(64);
    const rows = [
      { id: 1, owner_id: 7, status: 'generating', claim_token: token, heartbeat_at: new Date(0) },
    ];
    const service = makeService(rows);
    assert.equal(await service.claim(), null);
    assert.equal((await service.update(1, token, 'uploading', 'prompt-1')).status, 'uploading');
    assert.equal(rows[0].status, 'uploading');
  });

  it('rejects stale tokens and superseded jobs', async () => {
    const token = 'a'.repeat(64);
    const service = makeService([{ id: 1, owner_id: 7, status: 'superseded', claim_token: token }]);
    await assert.rejects(service.update(1, token), /no longer active/);
    await assert.rejects(service.update(1, 'b'.repeat(64)), /no longer active/);
  });

  it('makes completed heartbeats idempotent', async () => {
    const token = 'a'.repeat(64);
    const service = makeService([{ id: 1, owner_id: 7, status: 'succeeded', claim_token: token }]);
    assert.deepEqual(await service.update(1, token, 'generating'), { status: 'succeeded' });
  });

  it('validates H3 duration/resolution without changing cloud restrictions', () => {
    const helper = Object.create(ReferenceService.prototype);
    assert.equal(helper.normalizeVideoDuration('minimax-h3-local', 15), 15);
    assert.equal(helper.normalizeVideoResolution('minimax-h3-local', ''), 'preview');
    assert.throws(() => helper.normalizeVideoDuration('minimax-h3-local', 30));
    assert.throws(() => helper.normalizeVideoResolution('minimax-h3-local', '1080p'));
    assert.throws(() => helper.normalizeVideoDuration('wan2.7-i2v', 15));
  });

  it('accepts duplicate completion without probing or changing the result', async () => {
    const token = 'a'.repeat(64);
    const service = makeService([]);
    service.app.mysqlPool = {
      query: async () => [
        [
          {
            owner_id: 7,
            claim_token: token,
            object_key: 'local-videos/1.mp4',
            status: 'succeeded',
          },
        ],
      ],
    };
    assert.deepEqual(await service.complete(1, token, 'local-videos/1.mp4'), {
      status: 'succeeded',
    });
    await assert.rejects(service.complete(1, token, 'other.mp4'), /Invalid result/);
  });

  it('rejects completion of superseded jobs before touching media', async () => {
    const token = 'a'.repeat(64);
    const service = makeService([]);
    service.app.mysqlPool = {
      query: async () => [
        [
          {
            owner_id: 7,
            claim_token: token,
            object_key: 'local-videos/1.mp4',
            status: 'superseded',
          },
        ],
      ],
    };
    await assert.rejects(service.complete(1, token, 'local-videos/1.mp4'), /no longer active/);
  });

  it('supports text, first-frame, image and voice previews while rejecting original video', async () => {
    const service = Object.create(VideoService.prototype);
    const helper = Object.create(ReferenceService.prototype);
    helper.selectVideoReferenceImages = async () => ({ references: [], missing: [] });
    helper.selectVideoAudioReferences = async () => ({
      references: [],
      missing: [],
      totalDuration: 0,
      blockingReasons: [],
      limits: null,
    });
    const scene: any = { id: 1, prompt: '两个成年人在庭院切磋。', assets: [] };
    service.app = {
      config: { storyboard: { localWorkerKey: 'x'.repeat(32), localWorkerOwnerId: 7 } },
    };
    service.ctx = {
      service: {
        scene: { findById: async () => scene },
        storyboardReference: helper,
        sceneReference: { buildVideoFrameReferences: () => [] },
      },
    };
    const preview = (firstFrame: boolean) =>
      service.previewVideoGeneration(1, 'minimax-h3-local', 4, firstFrame, 'preview', '9:16', true);
    assert.equal((await preview(false)).media_input_mode, 'text');
    assert.equal((await preview(true)).will_generate_cover, true);
    helper.selectVideoReferenceImages = async () => ({
      references: [{ name: '角色甲', url: '/generated/hero.png' }],
      missing: [],
    });
    helper.selectVideoAudioReferences = async () => ({
      references: [{ name: '角色甲', url: '/generated/voice.wav', duration: 4 }],
      missing: [],
      totalDuration: 4,
      blockingReasons: [],
      limits: null,
    });
    const referenced = await preview(false);
    assert.equal(referenced.blocking_reasons.length, 0);
    assert.equal(referenced.media_input_mode, 'reference_media');
    assert.match(referenced.final_prompt, /<Picture 1>: 角色甲/);
    assert.match(referenced.final_prompt, /<Audio 1>: 角色甲/);
    assert.equal((await preview(true)).audio_reference_assets.length, 0);
    for (const asset of [{ type: 'video', file_url: 'reference.mp4' }]) {
      scene.assets = [asset];
      assert.match((await preview(true)).blocking_reasons.join(''), /暂不支持原始视频参考/);
    }
  });
});

describe('local worker authentication', () => {
  it('local voice references are optional and enforce the total duration limit', async () => {
    const helper = Object.create(ReferenceService.prototype);
    helper.app = { config: { storyboard: {} } };
    helper.resolveVoiceReferenceDuration = async (character: any) => character.seconds;
    const subject: any = {
      characters: [{ id: 1, name: '甲', voice_reference_url: '', seconds: 0 }],
    };
    assert.equal(
      (await helper.selectVideoAudioReferences(subject, false, true)).blockingReasons.length,
      0,
    );
    subject.characters = [1, 2].map((id) => ({
      id,
      name: String(id),
      voice_reference_url: `/generated/voice-${id}.wav`,
      seconds: 8,
    }));
    const result = await helper.selectVideoAudioReferences(subject, true, true);
    assert.equal(result.references.length, 2);
    assert.match(result.blockingReasons.join(''), /本地 H3.*总时长不能超过 15 秒/);
  });

  it('reference access rejects unknown kinds and indexes before resolving media', async () => {
    const service = Object.create(JobService.prototype);
    await assert.rejects(service.reference(1, 'token', 'video', 0), /Invalid reference/);
    await assert.rejects(service.reference(1, 'token', 'audio', -1), /Invalid reference/);
    service.transaction = async () => ({ input_json: JSON.stringify({ reference_images: [] }) });
    await assert.rejects(service.reference(1, 'token', 'image', 0), /Invalid reference/);
  });

  it('rejects wrong credentials without invoking the handler', async () => {
    const ctx: any = {
      path: '/api/local-worker/claim',
      app: { config: { storyboard: { localWorkerKey: 'x'.repeat(32), localWorkerOwnerId: 7 } } },
      get: () => 'Bearer incorrect',
    };
    let called = false;
    await auth()(ctx, async () => {
      called = true;
    });
    assert.equal(ctx.status, 401);
    assert.equal(called, false);
  });
  it('accepts the dedicated worker key and bypasses unrelated paths', async () => {
    const ctx: any = {
      path: '/api/local-worker/claim',
      app: { config: { storyboard: { localWorkerKey: 'x'.repeat(32), localWorkerOwnerId: 7 } } },
      get: () => `Bearer ${'x'.repeat(32)}`,
    };
    let called = false;
    await auth()(ctx, async () => {
      called = true;
    });
    assert.equal(called, true);
  });
});
