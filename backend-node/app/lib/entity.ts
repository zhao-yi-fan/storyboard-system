// @ts-nocheck
'use strict';

import { normalizeGeneratedAssetReference, resolveUrl } from './generated_asset';
import { toNullableDate, toNullableNumber, toNullableString } from './common';

function resolvePublicUrl(app: any, raw: unknown): string {
  return resolveUrl(app, normalizeGeneratedAssetReference(app, raw), app.config.storyboard.publicAppBaseUrl || '');
}

export function mapChapter(row: Record<string, any>) {
  return {
    id: Number(row.id),
    project_id: Number(row.project_id),
    title: row.title,
    summary: toNullableString(row.summary),
    sort_order: Number(row.sort_order || 0),
    created_at: toNullableDate(row.created_at),
    updated_at: toNullableDate(row.updated_at),
  };
}

export function mapScene(app: any, row: Record<string, any>) {
  return {
    id: Number(row.id),
    chapter_id: Number(row.chapter_id),
    project_id: Number(row.project_id),
    title: row.title,
    description: toNullableString(row.description),
    location: toNullableString(row.location),
    time_of_day: toNullableString(row.time_of_day),
    style_preset: toNullableString(row.style_preset),
    style_notes: toNullableString(row.style_notes),
    cover_url: resolvePublicUrl(app, row.cover_url),
    cover_preview_url: resolvePublicUrl(app, row.cover_preview_url),
    video_url: resolvePublicUrl(app, row.video_url),
    video_preview_url: resolvePublicUrl(app, row.video_preview_url),
    video_status: toNullableString(row.video_status),
    video_error: toNullableString(row.video_error),
    video_duration: toNullableNumber(row.video_duration),
    sort_order: Number(row.sort_order || 0),
    created_at: toNullableDate(row.created_at),
    updated_at: toNullableDate(row.updated_at),
  };
}

export function mapStoryboard(app: any, row: Record<string, any>) {
  return {
    id: Number(row.id),
    scene_id: Number(row.scene_id),
    chapter_id: Number(row.chapter_id),
    project_id: Number(row.project_id),
    shot_number: Number(row.shot_number || 0),
    content: row.content,
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
    characters: [],
    character_names: [],
  };
}
