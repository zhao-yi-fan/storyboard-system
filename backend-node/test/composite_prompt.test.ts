import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import {
  assertCompositePromptLength,
  buildCompositeVideoPrompt,
  extractFirstShotCoverPrompt,
  isCompositeStoryboardPrompt,
} from '../app/lib/composite_prompt';

const COMPOSITE_PROMPT = `[环境光影]：昏暗暖光

[人物站位]：@刀乐 平躺在床上

[要求]：保持轴线连续

镜号：1 | 场次：深夜 | @卧室 | [0-4s] | 近景，俯视 | 缓慢推进 | @刀乐 睁开眼睛 | 台词 & 音效：[疲惫] @刀乐："回来了"

镜号：2 | 场次：深夜 | @卧室 | [4–15s] | 特写，平视 | 横移 | 手机屏幕熄灭

[画面]：无水印，无字幕

【角色严格按照台词说话】`;

describe('test/composite_prompt.test.ts', () => {
  it('recognizes a composite prompt', () => {
    assert.equal(isCompositeStoryboardPrompt(COMPOSITE_PROMPT), true);
  });

  it('submits the original composite text without legacy camera expansion', () => {
    const prompt = buildCompositeVideoPrompt(COMPOSITE_PROMPT, {
      audio: false,
      useFirstFrame: true,
    });
    assert.ok(prompt.startsWith(COMPOSITE_PROMPT));
    assert.ok(prompt.includes('本次输出无声视频'));
    assert.ok(prompt.includes('以提供的首帧作为画面起点'));
    assert.ok(!prompt.includes('不要切镜'));
  });

  it('extracts only the common sections and first shot for a cover', () => {
    const prompt = extractFirstShotCoverPrompt(COMPOSITE_PROMPT);
    assert.ok(prompt.includes('[环境光影]'));
    assert.ok(prompt.includes('镜号：1'));
    assert.ok(prompt.includes('[画面]：无水印，无字幕'));
    assert.ok(prompt.includes('禁止多格漫画、拼贴、分屏'));
    assert.ok(!prompt.includes('镜号：2'));
    assert.ok(!prompt.includes('台词 & 音效'));
  });

  it('enforces the content length limit', () => {
    assert.equal(assertCompositePromptLength('a'.repeat(10000)).length, 10000);
    assert.throws(() => assertCompositePromptLength('a'.repeat(10001)), /10000/);
  });
});
