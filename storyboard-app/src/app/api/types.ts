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
  chapter_count?: number;
  scene_count?: number;
  storyboard_count?: number;
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
  camera_direction: string;
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

export type GenerateStoryboardVideoResult = {
  storyboard_id: number;
  video_url: string;
  video_preview_url?: string;
  storyboard: Storyboard;
};
