'use strict';

import { toNullableDate, toNullableNumber, toNullableString } from './common';

const generatedAsset = require('./generated_asset') as {
  normalizeGeneratedAssetReference: (app: App, raw: unknown) => string;
  resolveUrl: (app: App, raw: unknown, publicBaseUrl: string) => string;
};

type App = {
  config: { storyboard: { publicAppBaseUrl?: string } };
};

/** Raw database row as returned by mysql2 queries. */
export type DbRow = Record<string, unknown>;

/**
 * Minimal SQL executor surface (mysql2 pool / connection).
 * Results stay dynamic on purpose: call sites consume RowDataPacket-style
 * rows positionally (`rows[0]?.id`, `result.insertId`).
 */
export interface SqlExecutor {
  query: (sql: string, params?: unknown[]) => Promise<any>;
  execute: (sql: string, params?: unknown[]) => Promise<any>;
  getConnection: () => Promise<SqlExecutor>;
  beginTransaction: () => Promise<unknown>;
  commit: () => Promise<unknown>;
  rollback: () => Promise<unknown>;
  release: () => void;
}

export type DbPool = SqlExecutor;
export type DbConnection = SqlExecutor;

/** Egg.js config slice used across lib helpers. Known keys are typed, the rest stays unknown. */
export interface StoryboardAppConfig {
  publicAppBaseUrl?: string;
  [key: string]: unknown;
}

/** Minimal Egg application surface used by lib helpers. */
export interface LibApp {
  config: {
    storyboard: StoryboardAppConfig;
    [key: string]: unknown;
  };
  logger?: {
    error?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    info?: (...args: unknown[]) => void;
  };
}

export interface CharacterEntity {
  id: number;
  project_id: number;
  name: string;
  description: string;
  avatar_url: string;
  design_sheet_url: string;
  voice_reference_url: string;
  voice_reference_duration: number;
  design_sheet_status: string;
  design_sheet_error: string;
  voice_reference_status: string;
  voice_reference_error: string;
  voice_reference_text: string;
  voice_name: string;
  voice_prompt: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface AssetEntity {
  id: number;
  project_id: number;
  character_id?: number;
  name: string;
  type: string;
  file_url: string;
  cover_url: string;
  cover_status: string;
  cover_error: string;
  thumbnail_url: string;
  meta: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface ChapterEntity {
  id: number;
  project_id: number;
  title: string;
  summary: string;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface SceneEntity {
  id: number;
  chapter_id: number;
  project_id: number;
  title: string;
  description: string;
  prompt: string;
  location: string;
  time_of_day: string;
  style_preset: string;
  style_notes: string;
  cover_url: string;
  cover_preview_url: string;
  video_url: string;
  video_preview_url: string;
  video_poster_url: string;
  video_status: string;
  video_error: string;
  video_duration: number;
  generation_duration: number;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
  characters: CharacterEntity[];
  character_names: string[];
  assets: AssetEntity[];
  asset_names: string[];
  video_frame_references?: SceneVideoFrameEntity[];
}

export interface StoryboardEntity {
  id: number;
  scene_id: number;
  chapter_id: number;
  project_id: number;
  shot_number: number;
  content: string;
  dialogue: string;
  shot_type: string;
  mood: string;
  style_preset: string;
  style_notes: string;
  camera_direction: string;
  camera_motion: string;
  duration: number;
  background: string;
  thumbnail_url: string;
  thumbnail_preview_url: string;
  video_url: string;
  video_preview_url: string;
  video_status: string;
  video_error: string;
  video_duration: number;
  notes: string;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
  characters: CharacterEntity[];
  character_names: string[];
  assets: AssetEntity[];
  asset_names: string[];
}

export interface StoryboardMediaGenerationEntity {
  id: number;
  storyboard_id: number;
  media_type: string;
  model: string;
  status: string;
  result_url: string;
  preview_url: string;
  source_url: string;
  error_message: string;
  is_current: boolean;
  meta_json: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface SceneMediaGenerationEntity {
  id: number;
  scene_id: number;
  legacy_storyboard_id: number | null;
  media_type: string;
  model: string;
  status: string;
  result_url: string;
  preview_url: string;
  poster_url: string;
  source_url: string;
  error_message: string;
  is_current: boolean;
  meta_json: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface SceneVideoFrameEntity {
  id: number;
  project_id: number;
  source_scene_id: number;
  source_generation_id: number;
  source_scene_title: string;
  timestamp_ms: number;
  file_url: string;
  preview_url: string;
  target_scenes: DbRow[];
  created_at: string | null;
}

export interface ShotDirectionEntity {
  id: number;
  project_id: number;
  scene_id: number;
  storyboard_id: number;
  status: string;
  result_json: ShotDirectionAnalysis | null;
  error_message: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface RequirementEntity {
  id: number;
  project_id: number;
  chapter_id: number;
  kind: string;
  name: string;
  description: string | null;
  status: string;
  linked_entity_type: string | null;
  linked_entity_id: number | null;
  source_count: number;
  error_message: string | null;
  chapter_title?: string | null;
  file_url?: string | null;
  preview_url?: string | null;
  character_avatar_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ShotDirectionAnalysis {
  storyboard_id?: number;
  narrative_role?: unknown;
  emotional_shift?: unknown;
  continuity_from_previous?: unknown;
  continuity_to_next?: unknown;
  risk_flags?: unknown;
  camera_motion_suggestion?: unknown;
  shot_type_suggestion?: unknown;
}

/** Minimal shape both scenes and storyboards satisfy for reference selection. */
export interface ReferenceSubject {
  characters: CharacterEntity[];
  character_names: string[];
  assets: AssetEntity[];
  asset_names: string[];
}

export interface VideoFrameReferenceItem {
  type: string;
  name: string;
  url: string;
  source: string;
  frame_id: number;
}

/** Minimal reference shape for mention-binding (builders accept full items). */
export interface ReferenceInputItem {
  name: unknown;
  type: unknown;
  source: unknown;
  url: unknown;
}

export interface ReferenceMapping {
  index: number;
  name: string;
  type: string;
  source: string;
  mention: string;
  is_mentioned: boolean;
  prompt_text: string;
}

export interface ImageReferenceItem {
  asset_id: number;
  type: string;
  name: string;
  url: string;
  source: string;
}

export interface AudioReferenceItem {
  reference_id: string;
  character_id?: number;
  asset_id?: number;
  type: string;
  name: string;
  url: string;
  source: string;
  duration: number;
  voice_name: string;
}

export interface PreviewReferenceImage {
  type: string;
  name: string;
  url: string;
  source: string;
}

export interface StoryboardCoverPreview {
  mode: string;
  model: string;
  reference_images: PreviewReferenceImage[];
  final_prompt: string;
}

export interface StoryboardVideoPreview {
  use_first_frame: boolean;
  final_prompt: string;
  model: string;
  duration: number;
  resolution: string;
  audio: boolean;
  prompt_mode: string;
  source_image_status: string;
  reference_images: PreviewReferenceImage[];
  audio_reference_assets: AudioReferenceItem[];
  audio_reference_total_duration: number;
}

export interface SceneVideoPreview extends StoryboardVideoPreview {
  aspect_ratio: string;
}

function resolvePublicUrl(app: App, raw: unknown): string {
  return generatedAsset.resolveUrl(
    app,
    generatedAsset.normalizeGeneratedAssetReference(app, raw),
    app.config.storyboard.publicAppBaseUrl || '',
  );
}

export function mapChapter(row: DbRow): ChapterEntity {
  return {
    id: Number(row.id),
    project_id: Number(row.project_id),
    title: row.title as string,
    summary: toNullableString(row.summary),
    sort_order: Number(row.sort_order || 0),
    created_at: toNullableDate(row.created_at),
    updated_at: toNullableDate(row.updated_at),
  };
}

export function mapScene(app: App, row: DbRow): SceneEntity {
  return {
    id: Number(row.id),
    chapter_id: Number(row.chapter_id),
    project_id: Number(row.project_id),
    title: row.title as string,
    description: toNullableString(row.description),
    prompt: toNullableString(row.prompt),
    location: toNullableString(row.location),
    time_of_day: toNullableString(row.time_of_day),
    style_preset: toNullableString(row.style_preset),
    style_notes: toNullableString(row.style_notes),
    cover_url: resolvePublicUrl(app, row.cover_url),
    cover_preview_url: resolvePublicUrl(app, row.cover_preview_url),
    video_url: resolvePublicUrl(app, row.video_url),
    video_preview_url: resolvePublicUrl(app, row.video_preview_url),
    video_poster_url: resolvePublicUrl(app, row.video_poster_url),
    video_status: toNullableString(row.video_status),
    video_error: toNullableString(row.video_error),
    video_duration: toNullableNumber(row.video_duration),
    generation_duration: Number(row.generation_duration || 5),
    sort_order: Number(row.sort_order || 0),
    created_at: toNullableDate(row.created_at),
    updated_at: toNullableDate(row.updated_at),
    characters: [] as CharacterEntity[],
    character_names: [] as string[],
    assets: [] as AssetEntity[],
    asset_names: [] as string[],
  };
}

export function mapStoryboard(app: App, row: DbRow): StoryboardEntity {
  return {
    id: Number(row.id),
    scene_id: Number(row.scene_id),
    chapter_id: Number(row.chapter_id),
    project_id: Number(row.project_id),
    shot_number: Number(row.shot_number || 0),
    content: row.content as string,
    dialogue: toNullableString(row.dialogue),
    shot_type: toNullableString(row.shot_type),
    mood: toNullableString(row.mood),
    style_preset: toNullableString(row.style_preset),
    style_notes: toNullableString(row.style_notes),
    camera_direction: toNullableString(row.camera_direction),
    camera_motion: toNullableString(row.camera_motion),
    duration: toNullableNumber(row.duration),
    background: toNullableString(row.background),
    thumbnail_url: resolvePublicUrl(app, row.thumbnail_url),
    thumbnail_preview_url: resolvePublicUrl(app, row.thumbnail_preview_url),
    video_url: resolvePublicUrl(app, row.video_url),
    video_preview_url: resolvePublicUrl(app, row.video_preview_url),
    video_status: toNullableString(row.video_status),
    video_error: toNullableString(row.video_error),
    video_duration: toNullableNumber(row.video_duration),
    notes: toNullableString(row.notes),
    sort_order: Number(row.sort_order || 0),
    created_at: toNullableDate(row.created_at),
    updated_at: toNullableDate(row.updated_at),
    characters: [] as CharacterEntity[],
    character_names: [] as string[],
    assets: [] as AssetEntity[],
    asset_names: [] as string[],
  };
}
