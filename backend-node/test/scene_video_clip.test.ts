import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'mocha';

const cjsRequire = createRequire(import.meta.url);
const SceneVideoClipService = cjsRequire('../app/service/scene_video_clip');

describe('test/scene_video_clip.test.ts', () => {
  const scene = { video_duration: 10, generation_duration: 5 };
  const generation = { meta_json: JSON.stringify({ duration: 10 }) };

  it('accepts a video clip of at least four seconds', () => {
    assert.deepStrictEqual(
      SceneVideoClipService.prototype.normalizeRange(scene, generation, 1200, 5300),
      { startMs: 1200, endMs: 5300, durationMs: 10000 },
    );
  });

  it('rejects clips shorter than four seconds or outside the source video', () => {
    assert.throws(
      () => SceneVideoClipService.prototype.normalizeRange(scene, generation, 1200, 5100),
      /不能短于 4 秒/,
    );
    assert.throws(
      () => SceneVideoClipService.prototype.normalizeRange(scene, generation, 6000, 10100),
      /超出来源视频时长/,
    );
  });
});
