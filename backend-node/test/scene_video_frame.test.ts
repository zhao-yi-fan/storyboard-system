import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'mocha';

const cjsRequire = createRequire(import.meta.url);
const SceneService = cjsRequire('../app/service/scene');
const SceneVideoFrameService = cjsRequire('../app/service/scene_video_frame');

describe('test/scene_video_frame.test.ts', () => {
  it('uses generation metadata as the historical video duration', () => {
    const duration = SceneVideoFrameService.prototype.resolveDurationSeconds(
      { video_duration: 5, generation_duration: 5 },
      { meta_json: JSON.stringify({ duration: 12 }) },
    );
    assert.equal(duration, 12);
  });

  it('describes extracted frames as visual references with source traceability', () => {
    const references = SceneService.prototype.buildVideoFrameReferences([
      {
        id: 3,
        source_scene_id: 21,
        source_generation_id: 89,
        source_scene_title: '雨夜巷口',
        timestamp_ms: 4300,
        file_url: 'https://example.com/frame.webp',
      },
    ]);
    assert.deepStrictEqual(references, [
      {
        type: 'video_frame',
        name: '雨夜巷口 4.3s 抽帧',
        url: 'https://example.com/frame.webp',
        source: '来源片段「雨夜巷口」的视频版本 #89，时间点 4.3s',
        frame_id: 3,
      },
    ]);
  });

  it('rejects a target scene from another project before uploading', async () => {
    const context = {
      validateSource: async () => ({
        scene: { id: 21, project_id: 7, chapter_id: 4, sort_order: 1, video_duration: 5 },
        generation: { meta_json: JSON.stringify({ duration: 5 }) },
      }),
      ctx: {
        service: {
          scene: { findById: async () => ({ id: 22, project_id: 8, chapter_id: 4 }) },
        },
      },
    };
    await assert.rejects(
      () =>
        SceneVideoFrameService.prototype.create.call(context, 21, 89, {
          target_scene_id: 22,
          timestamp_ms: 1000,
          content_type: 'image/webp',
          buffer: Buffer.from('image'),
        }),
      /目标片段必须属于同一项目/,
    );
  });

  it('rejects invalid file types and out-of-range timestamps', async () => {
    const context = {
      validateSource: async () => ({
        scene: { id: 21, project_id: 7, chapter_id: 4, sort_order: 1, video_duration: 5 },
        generation: { meta_json: JSON.stringify({ duration: 5 }) },
      }),
      resolveDurationSeconds: SceneVideoFrameService.prototype.resolveDurationSeconds,
      ctx: {
        service: {
          scene: {
            findById: async () => ({ id: 21, project_id: 7, chapter_id: 4, sort_order: 1 }),
          },
        },
      },
    };
    await assert.rejects(
      () =>
        SceneVideoFrameService.prototype.create.call(context, 21, 89, {
          target_scene_id: 21,
          timestamp_ms: 5100,
          content_type: 'image/webp',
          buffer: Buffer.from('image'),
        }),
      /超出视频有效时长/,
    );
    await assert.rejects(
      () =>
        SceneVideoFrameService.prototype.create.call(context, 21, 89, {
          target_scene_id: 21,
          timestamp_ms: 1000,
          content_type: 'image/gif',
          buffer: Buffer.from('image'),
        }),
      /仅支持 WebP、JPEG 或 PNG/,
    );
  });
});
