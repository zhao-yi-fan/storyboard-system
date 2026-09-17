import type { StoryboardCoverGenerationReferenceImage } from "./storyboard";

export type { VideoAspectRatio, VideoResolution } from "../../constants/domain";

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

export type AIGenerationPreview = {
  action: string;
  model: string;
  fields: Record<string, string>;
  final_prompt: string;
  notes?: string[];
  reference_images?: StoryboardCoverGenerationReferenceImage[];
};
