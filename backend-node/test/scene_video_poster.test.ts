import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'mocha';

const cjsRequire = createRequire(import.meta.url);
const { GENERATION_STATUS, MEDIA_TYPE, VIDEO_MODEL } = cjsRequire(
  '../app/lib/domain_constants',
);
const SceneService = cjsRequire('../app/service/scene');
const SceneMediaGenerationService = cjsRequire('../app/service/scene_media_generation');
const SceneVideoPosterService = cjsRequire('../app/service/scene_video_poster');

describe('test/scene_video_poster.test.ts', () => {
  it('uses a deterministic poster filename for a video version', () => {
    assert.equal(
      SceneVideoPosterService.prototype.buildFilename(21, 89),
      'scene-21-video-89-poster.webp',
    );
  });

  it('reuses an existing video poster without extracting it again', async () => {
    const posterUrl = await SceneVideoPosterService.prototype.ensureForGeneration.call(
      {},
      {
        id: 89,
        scene_id: 21,
        media_type: MEDIA_TYPE.VIDEO,
        status: GENERATION_STATUS.SUCCEEDED,
        result_url: '/generated/scene-videos/scene-21.mp4',
        poster_url: '/generated/scene-video-posters/scene-21-video-89-poster.webp',
      },
    );
    assert.equal(posterUrl, '/generated/scene-video-posters/scene-21-video-89-poster.webp');
  });

  it('keeps a successful video usable when poster extraction fails', async () => {
    let warning = '';
    const context = {
      ensureForGeneration: async () => {
        throw new Error('ffmpeg failed');
      },
      ctx: {
        logger: {
          warn: (...args: unknown[]) => {
            warning = args.join(' ');
          },
        },
      },
    };
    const posterUrl = await SceneVideoPosterService.prototype.ensureBestEffort.call(context, {
      id: 89,
      scene_id: 21,
    });
    assert.equal(posterUrl, '');
    assert.match(warning, /ffmpeg failed/);
  });

  it('applies the selected video poster without changing the segment cover', async () => {
    let updatePayload: Record<string, unknown> | null = null;
    const context = {
      ctx: {
        service: {
          sceneVideoPoster: {
            ensureBestEffort: async () => '/generated/scene-video-posters/current.webp',
          },
        },
      },
      update: async (_sceneId: number, payload: Record<string, unknown>) => {
        updatePayload = payload;
        return payload;
      },
    };
    await SceneService.prototype.applyMediaGeneration.call(context, 21, {
      id: 89,
      scene_id: 21,
      media_type: MEDIA_TYPE.VIDEO,
      status: GENERATION_STATUS.SUCCEEDED,
      result_url: '/generated/scene-videos/current.mp4',
      preview_url: '/generated/scene-videos/current.mp4',
      error_message: '',
    });
    assert.deepStrictEqual(updatePayload, {
      video_url: '/generated/scene-videos/current.mp4',
      video_preview_url: '/generated/scene-videos/current.mp4',
      video_poster_url: '/generated/scene-video-posters/current.webp',
      video_status: GENERATION_STATUS.SUCCEEDED,
      video_error: '',
    });
    assert.equal(Object.hasOwn(updatePayload || {}, 'cover_url'), false);
  });

  it('stores stable generated paths when adding a poster to signed OSS media', async () => {
    let values: unknown[] = [];
    const signedUrl =
      'https://zhaoyifan-storyboard-media.oss-cn-beijing.aliyuncs.com/scene-videos/current.mp4?Expires=1';
    const context = {
      app: {
        config: {
          storyboard: {
            generatedAssetBasePath: 'generated',
            aliyunOssEndpoint: 'oss-cn-beijing-internal.aliyuncs.com',
            aliyunOssPublicEndpoint: 'oss-cn-beijing.aliyuncs.com',
            aliyunOssBucket: 'zhaoyifan-storyboard-media',
          },
        },
      },
      findById: async () => ({
        id: 89,
        model: VIDEO_MODEL.SEEDANCE_2,
        status: GENERATION_STATUS.SUCCEEDED,
        result_url: signedUrl,
        preview_url: signedUrl,
        poster_url: '',
        source_url: '',
        error_message: '',
        is_current: true,
        meta_json: '',
      }),
      pool: {
        execute: async (_sql: string, params: unknown[]) => {
          values = params;
        },
      },
    };
    await SceneMediaGenerationService.prototype.update.call(context, 89, {
      poster_url: '/generated/scene-video-posters/current.webp',
    });
    assert.equal(values[2], '/generated/scene-videos/current.mp4');
    assert.equal(values[3], '/generated/scene-videos/current.mp4');
    assert.equal(values[4], '/generated/scene-video-posters/current.webp');
  });
});
