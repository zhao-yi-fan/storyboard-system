'use strict';

import { toNullableDate, toNullableNumber, toNullableString } from './common';

const generatedAsset = require('./generated_asset') as {
  normalizeGeneratedAssetReference: (app: App, raw: unknown) => string;
  resolveUrl: (app: App, raw: unknown, publicBaseUrl: string) => string;
};

type App = {
  config: { storyboard: { publicAppBaseUrl?: string } };
};

function mapProject(app: App, row: Record<string, any>) {
  const publicAppBaseUrl = app.config.storyboard.publicAppBaseUrl || '';
  return {
    id: Number(row.id),
    name: row.name,
    description: toNullableString(row.description),
    script_text: toNullableString(row.script_text),
    video_url: generatedAsset.resolveUrl(
      app,
      generatedAsset.normalizeGeneratedAssetReference(app, row.video_url),
      publicAppBaseUrl,
    ),
    video_preview_url: generatedAsset.resolveUrl(
      app,
      generatedAsset.normalizeGeneratedAssetReference(app, row.video_preview_url),
      publicAppBaseUrl,
    ),
    video_poster_url: generatedAsset.resolveUrl(
      app,
      generatedAsset.normalizeGeneratedAssetReference(app, row.video_poster_url),
      publicAppBaseUrl,
    ),
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

export function mapProjectWithStats(app: App, row: Record<string, any>) {
  return {
    ...mapProject(app, row),
    chapter_count: Number(row.chapter_count || 0),
    scene_count: Number(row.scene_count || 0),
    storyboard_count: Number(row.storyboard_count || 0),
  };
}
