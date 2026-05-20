'use strict';
const { resolveUrl, normalizeGeneratedAssetReference } = require('./generated_asset');
const { toNullableString, toNullableNumber, toNullableDate, resolvePublicUrl } = (() => {
  function toNullableString(value) {
    return value == null ? '' : String(value);
  }

  function toNullableNumber(value) {
    return value == null ? 0 : Number(value);
  }

  function toNullableDate(value) {
    return value ? new Date(value).toISOString() : null;
  }

  function resolvePublicUrl(app, raw) {
    const value = toNullableString(raw).trim();
    if (!value) {
      return '';
    }

    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }

    if (value.startsWith('/')) {
      const base = (app.config.storyboard.publicAppBaseUrl || '').trim();
      if (base) {
        return `${base.replace(/\/$/, '')}${value}`;
      }
    }

    return value;
  }

  return { toNullableString, toNullableNumber, toNullableDate, resolvePublicUrl };
})();

function mapProject(app, row) {
  return {
    id: Number(row.id),
    name: row.name,
    description: toNullableString(row.description),
    script_text: toNullableString(row.script_text),
    video_url: resolveUrl(app, normalizeGeneratedAssetReference(app, row.video_url), app.config.storyboard.publicAppBaseUrl || ''),
    video_preview_url: resolveUrl(app, normalizeGeneratedAssetReference(app, row.video_preview_url), app.config.storyboard.publicAppBaseUrl || ''),
    video_status: toNullableString(row.video_status),
    video_error: toNullableString(row.video_error),
    video_duration: toNullableNumber(row.video_duration),
    pinned_at: toNullableDate(row.pinned_at),
    is_pinned: Boolean(row.pinned_at),
    created_at: toNullableDate(row.created_at),
    updated_at: toNullableDate(row.updated_at),
  };
}

exports.mapProject = mapProject;

exports.mapProjectWithStats = function mapProjectWithStats(app, row) {
  return {
    ...mapProject(app, row),
    chapter_count: Number(row.chapter_count || 0),
    scene_count: Number(row.scene_count || 0),
    storyboard_count: Number(row.storyboard_count || 0),
  };
};
