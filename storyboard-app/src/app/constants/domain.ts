export const GENERATION_STATUS = {
  IDLE: "idle",
  PENDING: "pending",
  ANALYZING: "analyzing",
  GENERATING: "generating",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  GENERATED: "generated",
  CONFIRMED: "confirmed",
} as const;

export type GenerationStatus =
  (typeof GENERATION_STATUS)[keyof typeof GENERATION_STATUS];

export const MEDIA_TYPE = {
  COVER: "cover",
  VIDEO: "video",
} as const;

export type MediaType = (typeof MEDIA_TYPE)[keyof typeof MEDIA_TYPE];

export const ASSET_KIND = {
  CHARACTER: "character",
  SCENE: "scene",
  PROP: "prop",
  VOICE: "voice",
} as const;

export type AssetKind = (typeof ASSET_KIND)[keyof typeof ASSET_KIND];

export const ENTITY_TYPE = {
  CHARACTER: "character",
  ASSET: "asset",
  PROJECT: "project",
} as const;

export type EntityType = (typeof ENTITY_TYPE)[keyof typeof ENTITY_TYPE];

export const ASSET_SOURCE_TYPE = {
  GENERATED: "generated",
  LEGACY_IMPORT: "legacy-import",
  MANUAL_UPLOAD: "manual-upload",
} as const;

export type AssetSourceType =
  (typeof ASSET_SOURCE_TYPE)[keyof typeof ASSET_SOURCE_TYPE];

export const VIDEO_MODEL = {
  SEEDANCE_2: "seedance-2.0",
  WAN_2_7_I2V: "wan2.7-i2v",
} as const;

export type VideoModel = (typeof VIDEO_MODEL)[keyof typeof VIDEO_MODEL];

export const VIDEO_RESOLUTION = {
  SD: "480p",
  HD: "720p",
  FULL_HD: "1080p",
} as const;

export type VideoResolution =
  (typeof VIDEO_RESOLUTION)[keyof typeof VIDEO_RESOLUTION];

export const VIDEO_ASPECT_RATIO = {
  PORTRAIT: "9:16",
} as const;

export type VideoAspectRatio =
  (typeof VIDEO_ASPECT_RATIO)[keyof typeof VIDEO_ASPECT_RATIO];

export const PROMPT_MODE = {
  COMPOSITE: "composite",
  LEGACY: "legacy",
} as const;

export type PromptMode = (typeof PROMPT_MODE)[keyof typeof PROMPT_MODE];

export const PROMPT_TOKEN_TYPE = {
  BADGE: "badge",
  TEXT: "text",
} as const;

export type PromptTokenType =
  (typeof PROMPT_TOKEN_TYPE)[keyof typeof PROMPT_TOKEN_TYPE];

export const GENERATION_INPUT_MODE = {
  REFERENCE: "reference",
  TEXT_ONLY: "text-only",
  FIRST_FRAME: "first_frame",
  REFERENCE_MEDIA: "reference_media",
  TEXT: "text",
} as const;

export type GenerationInputMode =
  (typeof GENERATION_INPUT_MODE)[keyof typeof GENERATION_INPUT_MODE];

export const SOURCE_IMAGE_STATUS = {
  EXISTING_COVER: "existing-cover",
  WILL_GENERATE_COVER: "will-generate-cover",
  NOT_REQUIRED: "not-required",
} as const;

export type SourceImageStatus =
  (typeof SOURCE_IMAGE_STATUS)[keyof typeof SOURCE_IMAGE_STATUS];

export const ASSET_LIBRARY_TAB = {
  CHARACTERS: "characters",
  SCENES: "scenes",
  PROPS: "props",
} as const;

export type AssetLibraryTab =
  (typeof ASSET_LIBRARY_TAB)[keyof typeof ASSET_LIBRARY_TAB];

export const ASSET_VIEW_MODE = {
  GRID: "grid",
  LIST: "list",
} as const;

export type AssetViewMode =
  (typeof ASSET_VIEW_MODE)[keyof typeof ASSET_VIEW_MODE];
