'use strict';
// @ts-nocheck

const { requestDeepSeekText } = require('./deepseek');

export const SCENE_DESCRIPTION_MAX_LENGTH = 10000;

export const SCENE_DESCRIPTION_SYSTEM_PROMPT = `你是专业的短剧片段描述编辑。请把用户提供的片段描述整理成简洁、连续、便于阅读的镜号描述。

必须遵守：
1. 只输出优化后的描述正文，不要解释、Markdown、代码块或前后说明。
2. 使用“镜号1：……”格式；存在自然的动作、视角或场景转换时才继续使用“镜号2：……”“镜号3：……”，不要为了增加镜号而拆分。
3. 每个镜号保持精简，只描述该段发生的人物、动作、场景和必要的台词含义。
4. 保留原文剧情事实、人物关系、动作顺序和台词含义，不得新增人物、道具、剧情转折或台词。
5. 不要输出时间区间、景别、机位、运镜、模型参数、生成约束、负面提示词、@资产引用或其他视频生成 Prompt 内容。
6. 输出总长度不得超过 10000 个字符。`;

function normalizeDescription(value) {
  const description = String(value || '').trim();
  if (!description) {
    throw new Error('片段描述不能为空');
  }
  if (description.length > SCENE_DESCRIPTION_MAX_LENGTH) {
    throw new Error(`片段描述最多支持 ${SCENE_DESCRIPTION_MAX_LENGTH} 个字符`);
  }
  return description;
}

export function buildSceneDescriptionUserMessage(title, description) {
  return [title ? `片段标题：${String(title).trim()}` : '', '请优化以下片段描述：', description]
    .filter(Boolean)
    .join('\n\n');
}

export async function optimizeSceneDescription(config, payload) {
  const originalDescription = normalizeDescription(payload?.description);
  const rawOptimizedDescription = await requestDeepSeekText(config, {
    systemPrompt: SCENE_DESCRIPTION_SYSTEM_PROMPT,
    userPrompt: buildSceneDescriptionUserMessage(payload?.title, originalDescription),
    temperature: 0.2,
    errorLabel: 'DeepSeek 片段描述优化',
  });
  const optimizedDescription = normalizeDescription(
    rawOptimizedDescription
      .replace(/^```(?:text|markdown)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim(),
  );
  if (!/^镜号\s*1\s*[：:]/.test(optimizedDescription)) {
    throw new Error('DeepSeek 片段描述优化失败：结果缺少“镜号1”');
  }

  return {
    original_description: originalDescription,
    optimized_description: optimizedDescription,
    model: String(config.deepSeekModel || ''),
  };
}

module.exports = {
  SCENE_DESCRIPTION_MAX_LENGTH,
  SCENE_DESCRIPTION_SYSTEM_PROMPT,
  buildSceneDescriptionUserMessage,
  optimizeSceneDescription,
};
