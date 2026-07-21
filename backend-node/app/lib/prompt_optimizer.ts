'use strict';
// @ts-nocheck

const { requestDeepSeekText } = require('./deepseek');
const { assertCompositePromptLength } = require('./composite_prompt');

export const SYSTEM_PROMPT = `你是专业的 AI 短剧分镜 Prompt 编辑师。你的任务是把用户提供的片段 Prompt 整理为规范、可直接用于视频生成的中文多镜号 Prompt。

必须遵守：
1. 只输出优化后的 Prompt 正文，不要解释、Markdown、代码块或前后说明。
2. 保留原文剧情事实、人物关系、台词含义、镜号顺序、时间段和所有以 @ 开头的资产引用；不得改名或删除引用。
3. 不得凭空新增人物、场景、道具、剧情转折或台词。
4. 每个镜号尽量使用“镜号：N | 场次：... | @场景 | [开始-结束s] | 景别，机位 | 镜头运动 | 动作与画面 | 台词 & 音效：...”结构；原文缺失的信息不要编造，可省略对应段。
5. 多个镜号之间保持动作、空间、轴线和视线连续，描述具体、可视化、无重复堆砌。
6. 公共信息优先整理为[环境光影]、[人物站位]、[要求]、[画面]和[禁令]等区块；没有的信息不要生成空区块。
7. 输出总长度不得超过 10000 个字符。`;

export function buildPromptOptimizationUserMessage(
  prompt: string,
  context: Record<string, unknown> = {},
) {
  const contextLines = [
    context.title ? `片段标题：${String(context.title)}` : '',
    context.duration ? `目标视频时长：${Number(context.duration)} 秒` : '',
  ].filter(Boolean);

  return `${contextLines.length ? `${contextLines.join('\n')}\n\n` : ''}请优化以下片段 Prompt：\n\n${prompt}`;
}

export function extractPromptMentions(prompt: string) {
  return Array.from(
    new Set(
      Array.from(
        String(prompt || '').matchAll(/@([^\s@|，。；：,;()[\]{}"'“”]+)/g),
        (match) => match[1],
      ),
    ),
  );
}

export function assertPromptMentionsPreserved(originalPrompt: string, optimizedPrompt: string) {
  const originalMentions = extractPromptMentions(originalPrompt);
  const optimizedMentionList = extractPromptMentions(optimizedPrompt);
  const originalMentionSet = new Set(originalMentions);
  const optimizedMentions = new Set(optimizedMentionList);
  const missingMentions = originalMentions.filter((mention) => !optimizedMentions.has(mention));
  if (missingMentions.length) {
    throw new Error(
      `AI 优化结果遗漏资产引用：${missingMentions.map((name) => `@${name}`).join('、')}`,
    );
  }
  const unexpectedMentions = optimizedMentionList.filter(
    (mention) => !originalMentionSet.has(mention),
  );
  if (unexpectedMentions.length) {
    throw new Error(
      `AI 优化结果新增了未知资产引用：${unexpectedMentions.map((name) => `@${name}`).join('、')}`,
    );
  }
}

export async function optimizeStoryboardPrompt(
  config: Record<string, unknown>,
  prompt: string,
  context: Record<string, unknown> = {},
) {
  const originalPrompt = assertCompositePromptLength(prompt);
  if (!originalPrompt.trim()) {
    throw new Error('提示词不能为空');
  }

  const rawOptimizedPrompt = await requestDeepSeekText(config, {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildPromptOptimizationUserMessage(originalPrompt, context),
    temperature: 0.25,
    errorLabel: 'DeepSeek 提示词优化',
  });
  const optimizedPrompt = assertCompositePromptLength(
    rawOptimizedPrompt.replace(/^```(?:text|markdown)?\s*/i, '').replace(/\s*```$/, ''),
  ).trim();

  if (!optimizedPrompt) {
    throw new Error('DeepSeek 提示词优化失败：返回内容为空');
  }
  assertPromptMentionsPreserved(originalPrompt, optimizedPrompt);

  return {
    original_prompt: originalPrompt,
    optimized_prompt: optimizedPrompt,
    model: String(config.deepSeekModel || ''),
  };
}

module.exports = {
  SYSTEM_PROMPT,
  assertPromptMentionsPreserved,
  buildPromptOptimizationUserMessage,
  extractPromptMentions,
  optimizeStoryboardPrompt,
};
