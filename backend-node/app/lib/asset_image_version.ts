import type { DbConnection, DbRow } from './entity';

export function imageEntityTable(type: string): string {
  if (type === 'character') return 'characters';
  if (type === 'asset') return 'assets';
  throw new Error('不支持的目标资产类型');
}

export async function lockImageEntity(
  conn: DbConnection,
  type: string,
  id: number,
  userId: number,
  projectId?: number,
): Promise<DbRow> {
  const table = imageEntityTable(type);
  const [rows] = await conn.query(
    `SELECT e.*, p.user_id FROM ${table} e JOIN projects p ON p.id = e.project_id
     WHERE e.id = ? AND p.user_id = ? AND e.deleted_at IS NULL AND p.deleted_at IS NULL FOR UPDATE`,
    [id, userId],
  );
  const entity = rows[0];
  if (!entity || (projectId && Number(entity.project_id) !== projectId))
    throw new Error('目标资产不存在或无权访问');
  if ((type === 'character' ? entity.design_sheet_status : entity.cover_status) === 'generating')
    throw new Error('图片正在生成，请等待任务结束后再更换');
  return entity;
}

export async function applyImageVersion(
  conn: DbConnection,
  type: string,
  id: number,
  version: DbRow,
) {
  await conn.execute(
    'UPDATE asset_versions SET is_current = 0 WHERE entity_type = ? AND entity_id = ? AND deleted_at IS NULL',
    [type, id],
  );
  await conn.execute(
    'UPDATE asset_versions SET is_current = 1 WHERE id = ? AND deleted_at IS NULL',
    [version.id],
  );
  if (type === 'character') {
    await conn.execute(
      "UPDATE characters SET design_sheet_url = ?, design_sheet_status = 'succeeded', design_sheet_error = NULL WHERE id = ? AND deleted_at IS NULL",
      [version.file_url, id],
    );
  } else {
    await conn.execute(
      "UPDATE assets SET cover_url = ?, thumbnail_url = ?, cover_status = 'succeeded', cover_error = NULL WHERE id = ? AND deleted_at IS NULL",
      [version.file_url, version.preview_url || '', id],
    );
  }
  await conn.execute(
    "UPDATE asset_requirements SET status = 'generated', error_message = NULL WHERE linked_entity_type = ? AND linked_entity_id = ? AND deleted_at IS NULL",
    [type, id],
  );
}
