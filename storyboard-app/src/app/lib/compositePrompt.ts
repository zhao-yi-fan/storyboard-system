import type { Scene, Storyboard } from "../api";

export const COMPOSITE_PROMPT_SPEC = {
  MAX_LENGTH: 10000,
  DEFAULT_REQUIREMENT:
    "严格遵守180度轴线与视线匹配原则，严防越轴跳切。画面干净又高级；画面里前中远景递进关系分明。极具影视写实感与物理细节真实感。",
  DEFAULT_PICTURE:
    "无水印，无字幕，无logo，无背景音乐。电影级光影，人物皮肤纹理清晰，自然微表情，真实肢体动作，电影质感，专业影视摄影。",
  DEFAULT_BAN:
    "视频全程严禁出现外形、着装、配饰完全相同的两个人；杜绝双胞胎或分身效果，确保同一时刻画面中该人物唯一。",
} as const;

export function isCompositeStoryboardPrompt(value: string | null | undefined) {
  const prompt = String(value || "").trim();
  return (
    /(?:^|\n)\s*镜号[：:]/.test(prompt) && /\[(?:环境光影|人物站位|要求|画面)\][：:]/.test(prompt)
  );
}

function mention(value: string | null | undefined) {
  const text = String(value || "").trim();
  return text ? `@${text.replace(/^@/, "")}` : "";
}

function joinParts(parts: Array<string | null | undefined>, separator = " | ") {
  return parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(separator);
}

export function buildLegacyCompositePrompt(shot: Storyboard, scene: Scene | null) {
  if (isCompositeStoryboardPrompt(shot.content)) return shot.content;

  const duration =
    Number.isInteger(shot.duration) && shot.duration >= 4 && shot.duration <= 15
      ? shot.duration
      : 5;
  const characterNames = Array.from(
    new Set([...(shot.character_names || []), ...(shot.characters || []).map((item) => item.name)]),
  ).filter(Boolean);
  const sceneName =
    shot.asset_names?.[0] || shot.assets?.[0]?.name || scene?.location || scene?.title || "";
  const camera = joinParts(
    [joinParts([shot.shot_type, shot.camera_direction], "，"), shot.camera_motion],
    " | ",
  );
  const dialogue = joinParts([shot.mood ? `[${shot.mood}]` : "", shot.dialogue], " ");
  const shotLine = joinParts([
    `镜号：${shot.shot_number || 1}`,
    scene?.time_of_day ? `场次：${scene.time_of_day}` : "",
    mention(sceneName),
    `[0-${duration}s]`,
    camera,
    String(shot.content || "").trim(),
    dialogue ? `台词 & 音效：${dialogue}` : "",
  ]);
  const position = characterNames.map(mention).join(" ");
  const environment = String(shot.style_notes || scene?.style_notes || "").trim();

  return [
    environment ? `[环境光影]：${environment}` : "",
    position ? `[人物站位]：${position}` : "",
    `[要求]：${COMPOSITE_PROMPT_SPEC.DEFAULT_REQUIREMENT}`,
    shotLine,
    `[画面]：${COMPOSITE_PROMPT_SPEC.DEFAULT_PICTURE}`,
    dialogue ? "【角色严格按照台词说话，不要增加台词或减少台词】" : "",
    `[禁令]：${COMPOSITE_PROMPT_SPEC.DEFAULT_BAN}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
