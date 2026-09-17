import type {
  AssetKind,
  GenerationInputMode,
  GenerationStatus,
  MediaType,
  PromptMode,
  PromptTokenType,
  SourceImageStatus,
  VideoAspectRatio,
  VideoResolution,
} from "../../constants/domain";
import type { Asset, Character } from "./asset";
import type { SceneGenerationReferenceMapping, SceneVideoFrame } from "./scene";

export type Storyboard = {
  id: number;
  scene_id: number;
  chapter_id: number;
  project_id: number;
  shot_number: number;
  content: string;
  dialogue?: string;
  shot_type?: string;
  mood?: string;
  camera_direction: string;
  camera_motion?: string;
  style_preset?: string;
  style_notes?: string;
  duration: number;
  background: string;
  thumbnail_url: string;
  thumbnail_preview_url?: string;
  video_url?: string;
  video_preview_url?: string;
  video_status?: string;
  video_error?: string;
  video_duration?: number;
  notes: string;
  sort_order: number;
  characters?: Character[];
  character_names?: string[];
  assets?: Asset[];
  asset_names?: string[];
  created_at?: string;
  updated_at?: string;
};

export type StoryboardMediaGeneration = {
  id: number;
  storyboard_id: number;
  media_type: MediaType | string;
  model: string;
  status: GenerationStatus | string;
  result_url?: string;
  preview_url?: string;
  poster_url?: string;
  source_url?: string;
  error_message?: string;
  is_current: boolean;
  meta_json?: string;
  created_at?: string;
  updated_at?: string;
  extracted_frames?: SceneVideoFrame[];
};

export type StoryboardCoverGenerationReferenceImage = {
  type: Extract<AssetKind, "scene" | "character"> | string;
  name: string;
  url: string;
  source: string;
};

export type StoryboardCoverGenerationFields = {
  scene_title: string;
  location: string;
  time_of_day: string;
  background: string;
  characters: string[];
  shot_type: string;
  camera_direction: string;
  content: string;
  mood: string;
  style_preset: string;
  style_notes: string;
  dialogue: string;
  notes: string;
};

export type StoryboardCoverGenerationPreview = {
  prompt_mode?: PromptMode;
  mode: Extract<GenerationInputMode, "reference" | "text-only"> | string;
  model: string;
  reference_images: StoryboardCoverGenerationReferenceImage[];
  missing_references: string[];
  fields: StoryboardCoverGenerationFields;
  final_prompt: string;
  can_generate_without_references: boolean;
  mappings?: SceneGenerationReferenceMapping[];
  bound_without_mentions?: string[];
  unbound_mentions?: string[];
};

export type StoryboardVideoGenerationFields = {
  scene_title: string;
  background: string;
  characters: string[];
  content: string;
  mood: string;
  style_preset: string;
  style_notes: string;
  dialogue: string;
  notes: string;
};

export type StoryboardVideoGenerationVideoFields = {
  shot_type: string;
  camera_direction: string;
  camera_motion: string;
  duration: number;
};

export type PromptBlueprintBeat = {
  label: string;
  description: string;
};

export type PromptBlueprint = {
  template: string;
  intro: string;
  subject?: string[];
  action?: string[];
  camera?: string[];
  style?: string[];
  effects?: string[];
  quality?: string[];
  consistency?: string[];
  audio?: string[];
  output?: string[];
  negative?: string[];
  timeline?: PromptBlueprintBeat[];
};

export type PromptDisplayBlock = {
  section: string;
  items: string[];
};

export type PromptDisplayToken = {
  type: PromptTokenType;
  label?: string;
  text: string;
};

export type StoryboardVideoGenerationPreview = {
  prompt_mode: PromptMode;
  model: string;
  duration: number;
  resolution: string;
  aspect_ratio: VideoAspectRatio;
  audio: boolean;
  use_first_frame: boolean;
  media_input_mode?: Extract<
    GenerationInputMode,
    "first_frame" | "reference_media" | "text"
  >;
  source_image_url: string;
  source_image_status: SourceImageStatus | string;
  will_generate_cover: boolean;
  reference_images?: StoryboardCoverGenerationReferenceImage[];
  omitted_reference_images?: StoryboardCoverGenerationReferenceImage[];
  missing_references?: string[];
  audio_reference_assets?: Array<{
    reference_id: string;
    character_id?: number;
    asset_id?: number;
    type: string;
    name: string;
    url: string;
    source: string;
    duration: number;
    voice_name?: string;
  }>;
  missing_audio_references?: string[];
  audio_reference_total_duration?: number;
  audio_reference_limits?: {
    max_count: number;
    min_duration: number;
    max_duration: number;
    max_total_duration: number;
    formats: string[];
  } | null;
  blocking_reasons?: string[];
  fields: StoryboardVideoGenerationFields;
  video_fields: StoryboardVideoGenerationVideoFields;
  template?: string;
  prompt_blueprint?: PromptBlueprint;
  prompt_display_blocks?: PromptDisplayBlock[];
  prompt_display_tokens?: PromptDisplayToken[];
  final_prompt: string;
};

export type StoryboardVideoGenerationOptions = {
  model?: string;
  duration?: number;
  resolution?: VideoResolution;
  aspect_ratio?: VideoAspectRatio;
  generate_audio?: boolean;
  use_first_frame?: boolean;
};
