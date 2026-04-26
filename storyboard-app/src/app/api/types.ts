export type ApiResponse<T = unknown> = {
  code: number;
  data: T;
  message: string;
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
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export type Character = {
  id: number;
  project_id: number;
  name: string;
  description: string;
  avatar_url: string;
  avatar_preview_url?: string;
  design_sheet_url?: string;
  design_sheet_preview_url?: string;
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
  shot_type: string;
  camera_direction: string;
  camera_motion: string;
  content: string;
  mood: string;
  style_preset: string;
  style_notes: string;
  dialogue: string;
  notes: string;
};

export type StoryboardVideoGenerationPreview = {
  model: string;
  duration: number;
  resolution: string;
  audio: boolean;
  source_image_url: string;
  source_image_status: "existing-cover" | "will-generate-cover" | string;
  will_generate_cover: boolean;
  fields: StoryboardVideoGenerationFields;
  final_prompt: string;
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
};
