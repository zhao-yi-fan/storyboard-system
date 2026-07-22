import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'mocha';

const cjsRequire = createRequire(import.meta.url);
const { buildSeedanceVideoPayload, generateSeedanceVideo } = cjsRequire('../app/lib/ai_clients');
const StoryboardService = cjsRequire('../app/service/storyboard');
const AssetService = cjsRequire('../app/service/asset');

const normalizationContext = {
  isSeedanceVideoModel: StoryboardService.prototype.isSeedanceVideoModel,
};

describe('test/seedance_video_generation.test.ts', () => {
  it('builds a Seedance first-frame payload without reference media', () => {
    const payload = buildSeedanceVideoPayload({
      model: 'doubao-seedance-2-0-260128',
      prompt: '人物从门口走入室内',
      imageUrl: 'https://example.com/first-frame.png',
      duration: 12,
      useFirstFrame: true,
      resolution: '1080p',
      aspectRatio: '9:16',
      generateAudio: true,
    });

    assert.equal(payload.duration, 12);
    assert.equal(payload.resolution, '1080p');
    assert.equal(payload.aspect_ratio, '9:16');
    assert.equal(payload.generate_audio, true);
    assert.deepStrictEqual(
      payload.content.map((item: { type: string; role?: string }) => [item.type, item.role]),
      [
        ['text', undefined],
        ['image_url', 'first_frame'],
      ],
    );
  });

  it('rejects mixing first-frame and reference media before calling Seedance', () => {
    assert.throws(
      () =>
        buildSeedanceVideoPayload({
          model: 'doubao-seedance-2-0-260128',
          prompt: '人物从门口走入室内',
          imageUrl: 'https://example.com/first-frame.png',
          useFirstFrame: true,
          referenceImageUrls: ['https://example.com/character.png'],
          referenceAudioUrls: ['https://example.com/voice.wav'],
        }),
      /首帧模式不能与角色、场景或音频参考素材混用/,
    );
  });

  it('builds a reference-media payload without a first frame', () => {
    const payload = buildSeedanceVideoPayload({
      model: 'doubao-seedance-2-0-260128',
      prompt: '人物从门口走入室内',
      useFirstFrame: false,
      referenceImageUrls: ['https://example.com/character.png', 'https://example.com/scene.png'],
      referenceAudioUrls: ['https://example.com/voice.wav'],
      generateAudio: true,
    });
    assert.deepStrictEqual(
      payload.content.map((item: { type: string; role?: string }) => [item.type, item.role]),
      [
        ['text', undefined],
        ['image_url', 'reference_image'],
        ['image_url', 'reference_image'],
        ['audio_url', 'reference_audio'],
      ],
    );
  });

  it('persists the provider task id and waits until Seedance reaches a terminal status', async () => {
    const responses = [
      { id: 'cgt-test-1' },
      new Error('temporary network failure'),
      { id: 'cgt-test-1', status: 'running' },
      {
        id: 'cgt-test-1',
        status: 'succeeded',
        content: { video_url: 'https://example.com/result.mp4' },
      },
    ];
    const originalFetch = global.fetch;
    const observedTaskIds: string[] = [];
    global.fetch = async () => {
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return new Response(JSON.stringify(next), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    try {
      const result = await generateSeedanceVideo(
        {
          config: {
            storyboard: {
              seedanceApiKey: 'test-key',
              seedanceModel: 'doubao-seedance-2-0-260128',
              seedanceRequestTimeoutSeconds: 1,
            },
          },
          logger: { warn() {}, error() {} },
        },
        '人物走入房间',
        '',
        10,
        false,
        [],
        [],
        '720p',
        false,
        {
          pollIntervalMs: 0,
          onTaskCreated: async (taskId: string) => observedTaskIds.push(taskId),
        },
      );
      assert.deepStrictEqual(observedTaskIds, ['cgt-test-1']);
      assert.equal(result.taskId, 'cgt-test-1');
      assert.equal(result.videoUrl, 'https://example.com/result.mp4');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('omits reference audio when audio is disabled', () => {
    const payload = buildSeedanceVideoPayload({
      model: 'doubao-seedance-2-0-260128',
      prompt: '无声镜头',
      duration: 5,
      useFirstFrame: false,
      referenceImageUrls: ['https://example.com/scene.png'],
      referenceAudioUrls: ['https://example.com/voice.wav'],
      resolution: '720p',
      generateAudio: false,
    });
    assert.equal(payload.generate_audio, false);
    assert.ok(!payload.content.some((item: { type: string }) => item.type === 'audio_url'));
  });

  it('accepts Seedance resolution and duration boundaries', () => {
    assert.equal(
      StoryboardService.prototype.normalizeVideoAspectRatio.call(
        normalizationContext,
        'seedance-2.0',
        '9:16',
      ),
      '9:16',
    );
    for (const resolution of ['480p', '720p', '1080p']) {
      assert.equal(
        StoryboardService.prototype.normalizeVideoResolution.call(
          normalizationContext,
          'seedance-2.0',
          resolution,
        ),
        resolution,
      );
    }
    assert.equal(
      StoryboardService.prototype.normalizeVideoDuration.call(
        normalizationContext,
        'seedance-2.0',
        4,
      ),
      4,
    );
    assert.equal(
      StoryboardService.prototype.normalizeVideoDuration.call(
        normalizationContext,
        'seedance-2.0',
        15,
      ),
      15,
    );
  });

  it('rejects unsupported Seedance specs instead of falling back', () => {
    assert.throws(
      () =>
        StoryboardService.prototype.normalizeVideoAspectRatio.call(
          normalizationContext,
          'seedance-2.0',
          '16:9',
        ),
      /仅支持 9:16/,
    );
    assert.throws(
      () =>
        StoryboardService.prototype.normalizeVideoResolution.call(
          normalizationContext,
          'seedance-2.0',
          '4k',
        ),
      /仅支持 480p、720p 或 1080p/,
    );
    for (const duration of [3, 16, 4.5]) {
      assert.throws(
        () =>
          StoryboardService.prototype.normalizeVideoDuration.call(
            normalizationContext,
            'seedance-2.0',
            duration,
          ),
        /视频时长/,
      );
    }
  });

  it('routes bound visual assets to images and excludes audio assets', async () => {
    const context = {
      app: { config: { storyboard: {} } },
      getAssetFileExtension: StoryboardService.prototype.getAssetFileExtension,
      isAudioAsset: StoryboardService.prototype.isAudioAsset,
      getAssetReferenceType: StoryboardService.prototype.getAssetReferenceType,
    };
    const result = await StoryboardService.prototype.selectAssetReferenceImages.call(context, {
      assets: [
        {
          id: 1,
          name: '卧室场景',
          type: 'scene',
          file_url: 'https://example.com/room.png',
        },
        {
          id: 2,
          name: '角色脚步声',
          type: 'sfx',
          file_url: 'https://example.com/steps.wav',
        },
      ],
    });

    assert.equal(result.references.length, 1);
    assert.equal(result.references[0].name, '卧室场景');
    assert.equal(result.references[0].type, 'scene');
  });

  it('routes bound audio assets into Seedance reference audio', async () => {
    const context = {
      app: { config: { storyboard: {} } },
      getAssetFileExtension: StoryboardService.prototype.getAssetFileExtension,
      isAudioAsset: StoryboardService.prototype.isAudioAsset,
      resolveAssetAudioDuration: async () => 4,
      resolveVoiceReferenceDuration: async () => 4,
    };
    const result = await StoryboardService.prototype.selectVideoAudioReferences.call(
      context,
      {
        characters: [],
        assets: [
          {
            id: 9,
            name: '雨声音效',
            type: 'audio',
            file_url: 'https://example.com/rain.mp3',
          },
        ],
      },
      true,
    );

    assert.equal(result.references.length, 1);
    assert.equal(result.references[0].reference_id, 'asset:9');
    assert.equal(result.references[0].url, 'https://example.com/rain.mp3');
    assert.deepEqual(result.blockingReasons, []);
  });

  it('recognizes audio assets before thumbnail generation', () => {
    assert.equal(
      AssetService.prototype.isAudioAsset({ type: 'sfx', file_url: '/assets/rain.bin' }),
      true,
    );
    assert.equal(
      AssetService.prototype.isAudioAsset({ type: 'other', file_url: '/assets/voice.m4a' }),
      true,
    );
    assert.equal(
      AssetService.prototype.isAudioAsset({ type: 'scene', file_url: '/assets/room.webp' }),
      false,
    );
  });
});
