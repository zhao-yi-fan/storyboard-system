// @ts-nocheck
'use strict';

import { normalizeGeneratedAssetReference, resolveUrl } from './generated_asset';
import { toNullableDate, toNullableNumber, toNullableString, toTrimmedString } from './common';

function resolvePublicUrl(app: any, raw: unknown): string {
  const value = toTrimmedString(raw);
  if (!value) {
    return '';
  }
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  if (value.startsWith('/')) {
    const base = toTrimmedString(app.config.storyboard.publicAppBaseUrl);
    if (base) {
      return `${base.replace(/\/$/, '')}${value}`;
    }
  }
  return value;
}

function mapProject(app: any, row: Record<string, any>) {
  const publicAppBaseUrl = app.config.storyboard.publicAppBaseUrl || '';
  return {
    id: Number(row.id),
    name: row.name,
    description: toNullableString(row.description),
    script_text: toNullableString(row.script_text),
    video_url: resolveUrl(app, normalizeGeneratedAssetReference(app, row.video_url), publicAppBaseUrl),
    video_preview_url: resolveUrl(app, normalizeGeneratedAssetReference(app, row.video_preview_url), publicAppBaseUrl),
    video_status: toNullableString(row.video_status),
    video_error: toNullableString(row.video_error),
    video_duration: toNullableNumber(row.video_duration),
    pinned_at: toNullableDate(row.pinned_at),
    is_pinned: Boolean(row.pinned_at),
    created_at: toNullableDate(row.created_at),
    updated_at: toNullableDate(row.updated_at),
  };
}

export { mapProject };

export function mapProjectWithStats(app: any, row: Record<string, any>) {
  return {
    ...mapProject(app, row),
    chapter_count: Number(row.chapter_count || 0),
    scene_count: Number(row.scene_count || 0),
    storyboard_count: Number(row.storyboard_count || 0),
  };
}
