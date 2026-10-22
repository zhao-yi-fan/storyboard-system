import type { DbPool } from './entity';

export async function ensurePersonalImageSchema(pool: DbPool) {
  const conn = await pool.getConnection();
  try {
    const [locks] = await conn.query(
      "SELECT GET_LOCK('personal_image_version_source', 30) AS acquired",
    );
    if (Number(locks[0]?.acquired) !== 1) throw new Error('personal image schema lock timeout');
    const [rows] = await conn.query(
      "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_versions' AND COLUMN_NAME = 'source_personal_asset_id' LIMIT 1",
    );
    if (!rows.length)
      await conn.query(
        'ALTER TABLE asset_versions ADD COLUMN source_personal_asset_id BIGINT UNSIGNED NULL',
      );
  } finally {
    await conn.query("SELECT RELEASE_LOCK('personal_image_version_source')").catch(() => null);
    conn.release();
  }
}
