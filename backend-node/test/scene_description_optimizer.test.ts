import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import {
  SCENE_DESCRIPTION_SYSTEM_PROMPT,
  buildSceneDescriptionUserMessage,
} from '../app/lib/scene_description_optimizer';

describe('test/scene_description_optimizer.test.ts', () => {
  it('asks for concise natural shot splitting without prompt parameters', () => {
    assert.ok(SCENE_DESCRIPTION_SYSTEM_PROMPT.includes('镜号1'));
    assert.ok(SCENE_DESCRIPTION_SYSTEM_PROMPT.includes('不要为了增加镜号而拆分'));
    assert.ok(SCENE_DESCRIPTION_SYSTEM_PROMPT.includes('不要输出时间区间'));
    assert.ok(SCENE_DESCRIPTION_SYSTEM_PROMPT.includes('运镜'));
    assert.ok(SCENE_DESCRIPTION_SYSTEM_PROMPT.includes('@资产引用'));
  });

  it('includes the draft title and description without adding a stored prompt', () => {
    const message = buildSceneDescriptionUserMessage('雨夜赴约', '李明走进小巷后停下脚步。');
    assert.ok(message.includes('片段标题：雨夜赴约'));
    assert.ok(message.includes('李明走进小巷后停下脚步。'));
    assert.ok(!message.includes('目标视频时长'));
  });
});
