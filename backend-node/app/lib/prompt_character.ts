'use strict';
/**
 * 构建角色主设定图 prompt。
 * @param {Record<string, unknown>} character 角色字段。
 * @returns {{template: string, blueprint: PromptBlueprint, prompt: string}} 模板、blueprint 和最终 prompt。
 * @example
 * buildCharacterDesignPrompt({ name: "林婉", description: "温婉端庄，外柔内刚" })
 * // => { template: "mythic-awakening", blueprint: {...}, prompt: "..." }
 */
import type { CharacterEntity } from './entity';
import {
  buildPromptBlueprint,
  normalizeTextList,
  PROMPT_TEMPLATE,
  renderPromptBlueprint,
  selectPromptTemplate,
} from './prompt_blueprint';

export function buildCharacterDesignPrompt(
  character: Pick<CharacterEntity, 'name' | 'description'>,
) {
  const template = PROMPT_TEMPLATE.DEFAULT;
  const blueprint = buildPromptBlueprint({
    template,
    intro: '为漫剧分镜系统生成高细节角色主设定板',
    subject: normalizeTextList([
      character.name ? `角色名称为${character.name}` : '',
      character.description ? `角色描述为${character.description}` : '',
      '唯一上传的人物参考图是角色外观的唯一事实来源，严格保持脸型、五官、发型、发色、年龄、体型、服装款式、服装颜色、服装材质以及参考图中实际存在的配饰一致',
      '版式描述只规定信息排布，不得据此重新设计角色，不得增加参考图中不存在的服装、首饰或人物特征',
    ]),
    action: [
      '输出最终定稿级角色主设定板，作为后续镜头封面和角色一致性的核心参考图',
      '重点呈现面部细节、妆容、发型和服装结构；发饰、耳饰、项链、腰饰、刺绣纹样及特殊面料仅在参考图中明确存在时呈现',
      '确保人物气质、年龄感、身形比例和服装细节在所有视角下稳定一致',
    ],
    camera: [
      '横向画布，画面中央从左到右排列正面全身、标准侧面全身和背面全身三视图',
      '三个全身视图保持相同身高、相同比例、相同服装和自然站立姿势，采用接近正交投影的视角，避免广角和透视畸变',
      '左上区域展示同一角色的高质量头肩特写，左侧展示从角色服装提取的主要配色板',
      '仅当人物参考图中明确存在具有辨识度的特殊材质、配饰、武器或随身物品时，才在左下区域展示对应局部细节；简单角色或没有明显配饰时省略该区域，并重新平衡版面留白',
      '右侧展示简洁的人体比例辅助线和身高标尺，右下区域展示缩小的完整角色比例图',
    ],
    style: [
      '页面像专业角色设定板，不是剧情插画，不是海报',
      '背景保持纯白或浅灰，不要剧情场景、环境背景或复杂道具',
      '版式整洁清晰，各区域间距规整，具有专业动画、游戏和影视制作角色模型设定板的信息层级',
      '不要电影光效、粒子、景深、逆光或复杂阴影，不要生成海报或单张剧情插画',
    ],
    quality: [
      '面料质感清晰；刺绣、提花、金属、珠玉等细节只呈现参考图中实际存在的内容',
      '头像区突出皮肤、眼睛、嘴唇和发丝；首饰细节仅在参考图中实际存在时呈现',
      '设定板各信息区分辨率充足，局部细节可读',
    ],
    consistency: [
      '脸型、五官、发型、发色、服装结构、身材比例以及参考图中实际存在的配饰位置完全一致',
      '不要换脸，不要改动参考图中已有发饰，不要丢失已有首饰和衣纹细节，也不得新增参考图中不存在的配饰',
      '所有区域都是同一个角色的技术视图，不得混入其他角色或不同脸型、不同服装版本',
    ],
    output: [
      '单张完整横版角色主设定板，不裁切头部、手、脚或服装',
      '不要输出大段文字，避免乱码，只保留简洁分区线、配色色块、标尺和视觉标记',
      '必选内容包含三视图、头像、配色和人体比例；材质与配饰信息区为按需内容，没有明显材质或配饰时直接省略',
      '不得为了填充版面虚构配饰、花纹、武器、道具或服装细节',
    ],
  });
  return {
    template,
    blueprint,
    prompt: renderPromptBlueprint(blueprint),
  };
}

/**
 * 构建角色主语音参考的文本 prompt。
 * @param {Record<string, unknown>} character 角色字段。
 * @returns {{template: string, blueprint: PromptBlueprint, prompt: string}} 模板、blueprint 和最终 prompt。
 * @example
 * buildCharacterVoicePromptText({ name: "林婉", description: "温婉端庄" })
 * // => { template: "cinematic-default", blueprint: {...}, prompt: "..." }
 */
export function buildCharacterVoicePromptText(character: CharacterEntity, userDirection = '') {
  const template = selectPromptTemplate([character.description]);
  const blueprint = buildPromptBlueprint({
    template,
    intro: '为漫剧角色设计一段稳定可复用的中文主语音',
    subject: normalizeTextList([
      character.name ? `角色名为${character.name}` : '',
      character.description ? `人设描述为${character.description}` : '',
    ]),
    style: ['自然真人感', '适合剧情对白', '声音气质贴合角色而不过度表演'],
    action: normalizeTextList([userDirection ? `创作者补充要求：${userDirection}` : '']),
    audio: ['吐字清晰', '口语节奏自然', '一句 3-5 秒短句', '不要主持腔', '不要广告腔'],
    output: ['生成 3-5 秒短句参考音频', '适合作为主语音参考'],
  });
  return {
    template,
    blueprint,
    prompt: renderPromptBlueprint(blueprint),
  };
}
