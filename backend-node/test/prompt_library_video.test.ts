import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { buildStoryboardVideoPrompt } from '../app/lib/prompt_library';

describe('test/prompt_library_video.test.ts', () => {
  it('omits audio requirements and first-frame wording for silent text generation', () => {
    const result = buildStoryboardVideoPrompt(
      { content: '人物转身', character_names: ['林婉'] },
      { title: '走廊' },
      5,
      { audio: false, useFirstFrame: false },
    );

    assert.ok(!result.prompt.includes('音频要求'));
    assert.ok(!result.prompt.includes('自动生成环境音'));
    assert.ok(result.prompt.includes('基于文本和参考素材'));
  });
});
