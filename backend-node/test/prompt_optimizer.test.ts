import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import {
  SYSTEM_PROMPT,
  assertPromptMentionsPreserved,
  buildPromptOptimizationUserMessage,
  extractPromptMentions,
} from '../app/lib/prompt_optimizer';

describe('test/prompt_optimizer.test.ts', () => {
  it('instructs DeepSeek to preserve mentions and require explicit shot structure', () => {
    assert.ok(SYSTEM_PROMPT.includes('保留'));
    assert.ok(SYSTEM_PROMPT.includes('@'));
    assert.ok(SYSTEM_PROMPT.includes('镜号：N'));
    assert.ok(SYSTEM_PROMPT.includes('不得凭空新增'));
    assert.ok(SYSTEM_PROMPT.includes('10000'));
  });

  it('includes scene context and the original prompt', () => {
    const message = buildPromptOptimizationUserMessage('@李明 走进 @雨夜小巷', {
      title: '雨夜赴约',
      duration: 8,
    });
    assert.ok(message.includes('片段标题：雨夜赴约'));
    assert.ok(message.includes('目标视频时长：8 秒'));
    assert.ok(message.includes('@李明 走进 @雨夜小巷'));
  });

  it('extracts unique asset mentions for result validation', () => {
    assert.deepEqual(extractPromptMentions('@李明 走进 @雨夜小巷，@李明 回头。'), [
      '李明',
      '雨夜小巷',
    ]);
  });

  it('rejects missing or newly invented asset mentions', () => {
    assert.doesNotThrow(() =>
      assertPromptMentionsPreserved('@李明 走进 @雨夜小巷', '@李明 在 @雨夜小巷 前行'),
    );
    assert.throws(
      () => assertPromptMentionsPreserved('@李明 走进 @雨夜小巷', '@李明 向前走'),
      /遗漏资产引用：@雨夜小巷/,
    );
    assert.throws(
      () => assertPromptMentionsPreserved('@李明 走进 @雨夜小巷', '@李明 和 @林婉 走进 @雨夜小巷'),
      /新增了未知资产引用：@林婉/,
    );
  });
});
