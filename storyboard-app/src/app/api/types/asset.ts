import type {
  AssetKind,
  AssetSourceType,
  EntityType,
  GenerationStatus,
} from "../../constants/domain";

export type Character = {
  id: number;
  project_id: number;
  name: string;
  description: string;
  avatar_url: string;
  design_sheet_url?: string;
  design_sheet_status?: GenerationStatus | string;
  design_sheet_error?: string;
  voice_reference_url?: string;
  voice_reference_duration?: number;
  voice_reference_text?: string;
  voice_name?: string;
  voice_prompt?: string;
  voice_reference_status?: GenerationStatus | string;
  voice_reference_error?: string;
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
  cover_status?: GenerationStatus | string;
  cover_error?: string;
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
  kind: Exclude<AssetKind, "voice">;
  name: string;
  description: string;
  status: GenerationStatus;
  linked_entity_type?: Exclude<EntityType, "project">;
  linked_entity_id?: number;
  file_url?: string;
  preview_url?: string;
  error_message?: string;
  can_generate?: boolean;
  blocking_reason?: string;
};

export type PersonalAsset = {
  id: number;
  user_id: number;
  kind: AssetKind;
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
  entity_type: Exclude<EntityType, "project">;
  entity_id: number;
  file_url: string;
  preview_url?: string;
  model: string;
  prompt?: string;
  status: string;
  is_current: boolean;
  source_type?: AssetSourceType | string;
  created_at?: string;
};

export type CharacterVoiceVersion = {
  id: number;
  character_id: number;
  file_url: string;
  duration: number;
  voice_name?: string;
  user_prompt?: string;
  effective_prompt?: string;
  reference_text?: string;
  source_type: AssetSourceType | string;
  status: string;
  is_current: boolean;
  created_at?: string;
};
