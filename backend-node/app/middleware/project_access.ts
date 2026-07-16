'use strict';
// @ts-nocheck

const response = require('../lib/response');

const ENTITY_TABLES = {
  chapters: 'chapters',
  scenes: 'scenes',
  storyboards: 'storyboards',
  characters: 'characters',
  assets: 'assets',
  'asset-requirements': 'asset_requirements',
};

module.exports = () => {
  return async function projectAccess(ctx, next) {
    if (!ctx.path.startsWith('/api/') || !ctx.state.currentUser) {
      await next();
      return;
    }

    let projectId = null;
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
        projectId = rows[0]?.project_id == null ? null : Number(rows[0].project_id);
      }
    }

    if (projectId != null) {
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
