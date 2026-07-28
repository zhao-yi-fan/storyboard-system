type StoryboardApp = {
  config: {
    storyboard: {
      publicAppBaseUrl?: string;
    };
  };
};

type DataRow = Record<string, unknown>;

const { resolveUrl } = require('./generated_asset') as {
  resolveUrl: (app: StoryboardApp, value: string, base: string) => string;
};

export function mapPersonalAsset(app: StoryboardApp, row: DataRow) {
  const base = app.config.storyboard.publicAppBaseUrl || '';
  return {
    ...row,
    id: Number(row.id),
    user_id: Number(row.user_id),
    source_project_id:
      row.source_project_id == null ? null : Number(row.source_project_id),
    source_entity_id: row.source_entity_id == null ? null : Number(row.source_entity_id),
    file_url: resolveUrl(app, String(row.file_url || ''), base),
    preview_url: resolveUrl(app, String(row.preview_url || ''), base),
  };
}

export function mapAssetVersion(app: StoryboardApp, row: DataRow) {
  const base = app.config.storyboard.publicAppBaseUrl || '';
  return {
    ...row,
    id: Number(row.id),
    entity_id: Number(row.entity_id),
    is_current: Boolean(row.is_current),
    file_url: resolveUrl(app, String(row.file_url || ''), base),
    preview_url: resolveUrl(app, String(row.preview_url || ''), base),
  };
}

export function mapCharacterVoiceVersion(app: StoryboardApp, row: DataRow) {
  return {
    ...row,
    id: Number(row.id),
    character_id: Number(row.character_id),
    duration: Number(row.duration || 0),
    is_current: Boolean(row.is_current),
    file_url: resolveUrl(
      app,
      String(row.file_url || ''),
      app.config.storyboard.publicAppBaseUrl || '',
    ),
  };
}

export function deriveAssetRequirementStatus(currentStatus: string, hasMedia: boolean) {
  if (currentStatus === 'generating' || currentStatus === 'failed') {
    return currentStatus;
  }
  if (!hasMedia) {
    return 'pending';
  }
  return currentStatus === 'confirmed' ? 'confirmed' : 'generated';
}
