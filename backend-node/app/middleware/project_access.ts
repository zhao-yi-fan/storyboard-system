'use strict';

const response = require('../lib/response');

const ENTITY_TABLES: Record<string, string> = {
  chapters: 'chapters',
  scenes: 'scenes',
  storyboards: 'storyboards',
  characters: 'characters',
  assets: 'assets',
  'asset-requirements': 'asset_requirements',
};

type MysqlPool = {
  query: (sql: string, params?: unknown[]) => Promise<[any[], any[]]>;
};

type AppContext = {
  path: string;
  state: { currentUser?: { id: number | string } };
  app: { mysqlPool: MysqlPool; config: { storyboard: { publicAppBaseUrl?: string } } };
  body: { code: number; data: unknown; message: string };
};

module.exports = () => {
  return async function projectAccess(ctx: AppContext, next: () => Promise<void>) {
    if (!ctx.path.startsWith('/api/') || !ctx.state.currentUser) {
      await next();
      return;
    }

    let projectId: number | null = null;
    const projectMatch = ctx.path.match(/^\/api\/projects\/(\d+)(?:\/|$)/);
    if (projectMatch) {
      projectId = Number(projectMatch[1]);
    } else {
      const entityMatch = ctx.path.match(
        /^\/api\/(chapters|scenes|storyboards|characters|assets|asset-requirements)\/(\d+)(?:\/|$)/,
      );
      if (entityMatch) {
        const table = ENTITY_TABLES[entityMatch[1]];
        const [rows] = await ctx.app.mysqlPool.query(
          `SELECT project_id FROM \`${table}\` WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
          [Number(entityMatch[2])],
        );
        projectId =
          rows[0]?.project_id === null || rows[0]?.project_id === undefined
            ? null
            : Number(rows[0].project_id);
      }
    }

    if (projectId !== null && projectId !== undefined) {
      const [projects] = await ctx.app.mysqlPool.query(
        'SELECT id FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1',
        [projectId, Number(ctx.state.currentUser.id)],
      );
      if (!projects.length) {
        response.error(ctx, '无权访问该项目');
        return;
      }
    }

    await next();
  };
};
