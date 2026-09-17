export type Project = {
  id: number;
  name: string;
  description: string;
  script_text?: string;
  scriptText?: string;
  video_url?: string;
  video_preview_url?: string;
  video_poster_url?: string;
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

export type ComposeProjectVideoResult = {
  project_id: number;
  video_url: string;
  video_preview_url?: string;
  video_status?: string;
  video_error?: string;
  video_duration?: number;
  project: Project;
};
