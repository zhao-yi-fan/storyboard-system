'use strict';

type PoolLike = {
  query: (sql: string, params?: unknown[]) => Promise<[any[], unknown]>;
  execute: (sql: string, params?: unknown[]) => Promise<[any, unknown]>;
};

export type SchemaStep = {
  name: string;
  ensure: (pool: PoolLike) => Promise<void>;
};

export async function ensureSchemaMigrationsTable(pool: PoolLike) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(191) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'applied',
      error_message TEXT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

/**
 * 按顺序执行 schema 步骤并留记录：已标记 applied 的跳过，
 * 成功记 applied，失败记 failed 并原错抛出（调用方决定是否阻断启动）。
 */
export async function runSchemaSteps(pool: PoolLike, steps: SchemaStep[]): Promise<void> {
  for (const step of steps) {
    const [rows] = await pool.query('SELECT status FROM schema_migrations WHERE name = ? LIMIT 1', [
      step.name,
    ]);
    if (rows.length && rows[0].status === 'applied') continue;
    try {
      await step.ensure(pool);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await pool.execute(
        `INSERT INTO schema_migrations (name, status, error_message)
         VALUES (?, 'failed', ?)
         ON DUPLICATE KEY UPDATE status = 'failed', error_message = VALUES(error_message)`,
        [step.name, message.slice(0, 2000)],
      );
      throw error;
    }
    await pool.execute(
      `INSERT INTO schema_migrations (name, status, error_message)
       VALUES (?, 'applied', NULL)
       ON DUPLICATE KEY UPDATE status = 'applied', error_message = NULL`,
      [step.name],
    );
  }
}
