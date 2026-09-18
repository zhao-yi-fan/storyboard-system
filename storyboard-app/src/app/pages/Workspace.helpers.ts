import type {
  Asset,
  Project,
  Scene,
  SceneMediaGeneration,
  Storyboard,
  StoryboardMediaGeneration,
  VideoAspectRatio,
} from "../api";
import { PROMPT_MENTION_CATEGORY } from "../components/workspace/RichPromptEditor";
import { GENERATION_STATUS, VIDEO_ASPECT_RATIO, VIDEO_MODEL } from "../constants/domain";
import { buildLegacyCompositePrompt } from "../lib/compositePrompt";

export const VIDEO_MODEL_OPTIONS = [
  { value: VIDEO_MODEL.SEEDANCE_2, label: "Seedance 2.0" },
  { value: VIDEO_MODEL.WAN_2_7_I2V, label: "Wan 2.7 I2V" },
] as const;
export const FIXED_VIDEO_ASPECT_RATIO: VideoAspectRatio = VIDEO_ASPECT_RATIO.PORTRAIT;

export const AUDIO_ASSET_PATTERN = /(audio|voice|sound|music|sfx|配音|语音|音频|音乐|音效)/i;
export const SCENE_ASSET_PATTERN = /(scene|background|location|场景|背景|地点)/i;
export const IMAGE_ASSET_PATTERN =
  /(image|photo|picture|reference|prop|costume|图片|图像|照片|参考|道具|服装)/i;

export function getAssetFileExtension(asset: Asset) {
  const source = String(asset.file_url || "").split(/[?#]/)[0];
  return source.includes(".") ? source.slice(source.lastIndexOf(".") + 1).toLowerCase() : "";
}

export function getAssetMentionPresentation(asset: Asset) {
  const type = String(asset.type || "").trim();
  const extension = getAssetFileExtension(asset);
  const isAudio =
    AUDIO_ASSET_PATTERN.test(type) ||
    ["mp3", "wav", "m4a", "aac", "ogg", "flac"].includes(extension);
  if (isAudio) {
    return { category: PROMPT_MENTION_CATEGORY.AUDIO, media: ["audio" as const] };
  }
  const isScene = SCENE_ASSET_PATTERN.test(type);
  const isImage =
    isScene ||
    IMAGE_ASSET_PATTERN.test(type) ||
    ["png", "jpg", "jpeg", "webp", "gif", "avif", "bmp"].includes(extension) ||
    !!asset.cover_url;
  if (isScene) {
    return { category: PROMPT_MENTION_CATEGORY.SCENE, media: ["image" as const] };
  }
  if (isImage) {
    return { category: PROMPT_MENTION_CATEGORY.IMAGE, media: ["image" as const] };
  }
  return { category: PROMPT_MENTION_CATEGORY.OTHER, media: [] };
}

export const PROMPT_SECTION_BREAKS = [
  "主体与画面核心：",
  "动作与叙事重点：",
  "镜头设计：",
  "风格气质：",
  "特效与氛围：",
  "一致性要求：",
  "音频要求：",
  "画质与完成度：",
  "输出要求：",
  "负向约束：",
  "节奏分段：",
  "首段：",
  "中段：",
  "尾段：",
  "开场：",
  "高潮：",
  "收束：",
] as const;

export const formatPromptForDisplay = (prompt: string | null | undefined) => {
  const raw = String(prompt ?? "").trim();
  if (!raw) return "-";
  return PROMPT_SECTION_BREAKS.reduce((formatted, marker) => {
    const next = formatted.replaceAll(marker, `\n${marker}`);
    return next.startsWith("\n") ? next.slice(1) : next;
  }, raw);
};

export type ShotFormState = {
  content: string;
};

export const emptyShotForm: ShotFormState = {
  content: "",
};

export const emptySceneForm = {
  title: "",
  description: "",
};

export const emptyDescriptionOptimization = {
  open: false,
  loading: false,
  original: "",
  candidate: "",
  model: "",
  error: "",
};

export const buildShotFormState = (
  shot: Storyboard | null,
  scene: Scene | null,
): ShotFormState => ({
  content: scene?.prompt ?? (shot ? buildLegacyCompositePrompt(shot, scene) : ""),
});

export function sceneToWorkspaceClip(scene: Scene): Storyboard {
  return {
    id: scene.id,
    scene_id: scene.id,
    chapter_id: scene.chapter_id,
    project_id: scene.project_id,
    shot_number: 1,
    content: scene.prompt ?? "",
    camera_direction: "",
    duration: scene.generation_duration ?? 5,
    background: scene.location ?? scene.title,
    thumbnail_url: scene.cover_url ?? "",
    thumbnail_preview_url: scene.cover_preview_url,
    video_url: scene.video_url,
    video_preview_url: scene.video_preview_url,
    video_status: scene.video_status,
    video_error: scene.video_error,
    video_duration: scene.video_duration,
    notes: "",
    sort_order: scene.sort_order,
    characters: scene.characters ?? [],
    character_names: scene.character_names ?? [],
    assets: scene.assets ?? [],
    asset_names: scene.asset_names ?? [],
    created_at: scene.created_at,
    updated_at: scene.updated_at,
  };
}

export function sceneMediaToWorkspaceMedia(item: SceneMediaGeneration): StoryboardMediaGeneration {
  return { ...item, storyboard_id: item.scene_id };
}

export function getStoryboardVideoPreviewSrc(storyboard?: Storyboard | null) {
  if (!storyboard) return "";
  return storyboard.video_preview_url ?? storyboard.video_url ?? "";
}

export const getStoryboardPreviewSrc = (shot: Storyboard | null | undefined) =>
  shot?.thumbnail_preview_url ?? shot?.thumbnail_url ?? "";

export const getSceneNavigatorThumbnailSrc = (scene: Scene | null | undefined) =>
  scene?.video_poster_url ?? scene?.cover_preview_url ?? scene?.cover_url ?? "";

export const getProjectVideoPreviewSrc = (project: Project | null | undefined) =>
  project?.video_preview_url ?? project?.video_url ?? "";

export const getGenerationPreviewSrc = (generation: StoryboardMediaGeneration | null | undefined) =>
  generation?.preview_url ?? generation?.result_url ?? "";

export const isSeedanceVideoModel = (model: string) => model === VIDEO_MODEL.SEEDANCE_2;

export const buildCoverPreviewItems = (generations: StoryboardMediaGeneration[]) =>
  generations
    .filter(
      (generation) => generation.status === GENERATION_STATUS.SUCCEEDED && !!generation.result_url,
    )
    .map((generation) => ({
      src: generation.result_url as string,
      alt: `首帧历史 ${generation.id}`,
    }));

export const formatShotNumber = (num?: number) => String(num ?? 0).padStart(3, "0");

export const formatShanghaiDateTime = (dateStr?: string) => {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(new Date(dateStr));
};
