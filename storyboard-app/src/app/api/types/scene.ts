import type { GenerationStatus, MediaType } from "../../constants/domain";
import type { Asset, Character } from "./asset";
import type { Storyboard, StoryboardCoverGenerationReferenceImage } from "./storyboard";

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
  video_poster_url?: string;
  video_status?: string;
  video_error?: string;
  video_duration?: number;
  generation_duration: number;
  characters?: Character[];
  character_names?: string[];
  assets?: Asset[];
  asset_names?: string[];
  video_frame_references?: SceneVideoFrame[];
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export type SceneVideoFrameTarget = {
  id: number;
  title: string;
  usage_type: "reference_image" | string;
};

export type SceneVideoFrame = {
  id: number;
  project_id: number;
  source_scene_id: number;
  source_generation_id: number;
  source_scene_title: string;
  timestamp_ms: number;
  file_url: string;
  preview_url: string;
  target_scenes: SceneVideoFrameTarget[];
  created_at?: string | null;
};

export type SceneMediaGeneration = {
  id: number;
  scene_id: number;
  legacy_storyboard_id?: number | null;
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

export type SceneMediaMutationResult = {
  scene: Scene;
  media_generations: SceneMediaGeneration[];
};

export type PromptOptimizationResult = {
  original_prompt: string;
  optimized_prompt: string;
  model: string;
};

export type SceneDescriptionOptimizationResult = {
  original_description: string;
  optimized_description: string;
  model: string;
};

export type SceneGenerationReferenceMapping = {
  index: number;
  name: string;
  type: string;
  source: string;
  mention: string;
  is_mentioned: boolean;
  prompt_text: string;
};

export type SceneGenerationReferences = {
  reference_images: StoryboardCoverGenerationReferenceImage[];
  missing_references: string[];
  mappings: SceneGenerationReferenceMapping[];
  bound_without_mentions: string[];
  unbound_mentions: string[];
  recognized_bound_mentions: string[];
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
  status: GenerationStatus | string;
  result_json: StoryboardDirectionAnalysisResult | null;
  error_message: string;
  created_at?: string | null;
  updated_at?: string | null;
};
