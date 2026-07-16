export type ApiResponse<T = unknown> = {
  code: number;
  data: T;
  message: string;
};

export type AuthUser = {
  id: number;
  account: string;
  display_name: string;
  role_label: string;
  is_active?: boolean;
  last_login_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type Project = {
  id: number;
  name: string;
  description: string;
  script_text?: string;
  scriptText?: string;
  video_url?: string;
  video_preview_url?: string;
  video_status?: string;
  video_error?: string;
  video_duration?: number;
  chapter_count?: number;
  scene_count?: number;
  storyboard_count?: number;
  pinned_at?: string;
  is_pinned?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Chapter = {
  id: number;
  project_id: number;
  title: string;
  summary: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export type Scene = {
  id: number;
  chapter_id: number;
  project_id: number;
  title: string;
  description: string;
  prompt: string;
  location: string;
  time_of_day: string;
  style_preset?: string;
  style_notes?: string;
  cover_url?: string;
  cover_preview_url?: string;
  video_url?: string;
  video_preview_url?: string;
  video_status?: string;
  video_error?: string;
  video_duration?: number;
  generation_duration: number;
  characters?: Character[];
  character_names?: string[];
  assets?: Asset[];
  asset_names?: string[];
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export type SceneMediaGeneration = {
  id: number;
  scene_id: number;
  legacy_storyboard_id?: number | null;
  media_type: "cover" | "video" | string;
  model: string;
  status: "pending" | "generating" | "succeeded" | "failed" | string;
  result_url?: string;
  preview_url?: string;
  source_url?: string;
  error_message?: string;
  is_current: boolean;
  meta_json?: string;
  created_at?: string;
  updated_at?: string;
};

export type SceneMediaMutationResult = {
  scene: Scene;
  media_generations: SceneMediaGeneration[];
};

export type Character = {
  id: number;
  project_id: number;
  name: string;
  description: string;
  avatar_url: string;
  design_sheet_url?: string;
  voice_reference_url?: string;
  voice_reference_duration?: number;
  voice_reference_text?: string;
  voice_name?: string;
  voice_prompt?: string;
  created_at?: string;
  updated_at?: string;
};

export type Asset = {
  id: number;
  project_id: number;
  character_id?: number;
  name: string;
  type: string;
  file_url: string;
  cover_url?: string;
  thumbnail_url?: string;
  meta?: string;
  created_at?: string;
  updated_at?: string;
};

export type AssetRequirement = {
  id: number;
  project_id: number;
  chapter_id: number;
  chapter_title: string;
  kind: "character" | "scene" | "prop";
  name: string;
  description: string;
  status: "pending" | "generating" | "generated" | "confirmed" | "failed";
  linked_entity_type?: "character" | "asset";
  linked_entity_id?: number;
  file_url?: string;
  preview_url?: string;
  error_message?: string;
};

export type PersonalAsset = {
  id: number;
  user_id: number;
  kind: "character" | "scene" | "prop" | "voice";
  name: string;
  description?: string;
  file_url?: string;
  preview_url?: string;
  source_project_id?: number | null;
  source_entity_type?: string | null;
  source_entity_id?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type AssetVersion = {
  id: number;
  entity_type: "character" | "asset";
  entity_id: number;
  file_url: string;
  preview_url?: string;
  model: string;
  prompt?: string;
  status: string;
  is_current: boolean;
  created_at?: string;
};

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
  media_type: "cover" | "video" | string;
  model: string;
  status: "pending" | "generating" | "succeeded" | "failed" | string;
  result_url?: string;
  preview_url?: string;
  source_url?: string;
  error_message?: string;
  is_current: boolean;
  meta_json?: string;
  created_at?: string;
  updated_at?: string;
};

export type StoryboardMediaMutationResult = {
  storyboard: Storyboard;
  media_generations: StoryboardMediaGeneration[];
};

export type StoryboardDirectionAnalysisResult = {
  narrative_role: string;
  emotional_shift: string;
  continuity_from_previous: string;
  continuity_to_next: string;
  camera_motion_suggestion: string;
  shot_type_suggestion: string;
  risk_flags: string[];
};

export type StoryboardDirectionAnalysis = {
  id: number;
  project_id: number;
  scene_id: number;
  storyboard_id: number;
  status: "pending" | "analyzing" | "succeeded" | "failed" | string;
  result_json: StoryboardDirectionAnalysisResult | null;
  error_message: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type GenerateStoryboardCoverResult = {
  storyboard_id: number;
  thumbnail_url: string;
  thumbnail_preview_url?: string;
  storyboard: Storyboard;
};

export type StoryboardCoverGenerationReferenceImage = {
  type: "scene" | "character" | string;
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
  prompt_mode?: "composite" | "legacy";
  mode: "reference" | "text-only" | string;
  model: string;
  reference_images: StoryboardCoverGenerationReferenceImage[];
  missing_references: string[];
  fields: StoryboardCoverGenerationFields;
  final_prompt: string;
  can_generate_without_references: boolean;
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
  type: "badge" | "text";
  label?: string;
  text: string;
};

export type StoryboardVideoGenerationPreview = {
  prompt_mode: "composite" | "legacy";
  model: string;
  duration: number;
  resolution: string;
  audio: boolean;
  use_first_frame: boolean;
  source_image_url: string;
  source_image_status: "existing-cover" | "will-generate-cover" | "not-required" | string;
  will_generate_cover: boolean;
  reference_images?: StoryboardCoverGenerationReferenceImage[];
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

export type VideoResolution = "480p" | "720p" | "1080p";

export type StoryboardVideoGenerationOptions = {
  model?: string;
  duration?: number;
  resolution?: VideoResolution;
  generate_audio?: boolean;
  use_first_frame?: boolean;
};

export type GenerateStoryboardVideoResult = {
  storyboard_id: number;
  video_url: string;
  video_preview_url?: string;
  storyboard: Storyboard;
};

export type GenerateSceneCoverResult = {
  scene_id: number;
  cover_url: string;
  cover_preview_url?: string;
  scene: Scene;
};

export type SceneBatchCoverFailure = {
  storyboard_id: number;
  error: string;
};

export type GenerateSceneStoryboardCoversResult = {
  scene: Scene;
  storyboards: Storyboard[];
  generated_count: number;
  failed: SceneBatchCoverFailure[];
};

export type ComposeSceneVideoResult = {
  scene_id: number;
  video_url: string;
  video_preview_url?: string;
  video_status?: string;
  video_error?: string;
  video_duration?: number;
  scene: Scene;
};

export type ComposeProjectVideoResult = {
  project_id: number;
  video_url: string;
  video_preview_url?: string;
  video_status?: string;
  video_error?: string;
  video_duration?: number;
  project: Project;
};

export type AIGenerationPreview = {
  action: string;
  model: string;
  fields: Record<string, string>;
  final_prompt: string;
  notes?: string[];
  reference_images?: StoryboardCoverGenerationReferenceImage[];
};
