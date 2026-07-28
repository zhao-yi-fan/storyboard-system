import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'mocha';

const cjsRequire = createRequire(import.meta.url);
const { GENERATION_STATUS } = cjsRequire('../app/lib/domain_constants');
const ProjectService = cjsRequire('../app/service/project');
const ProjectVideoPosterService = cjsRequire('../app/service/project_video_poster');

describe('test/project_video_poster.test.ts', () => {
  it('returns the project list without waiting for background poster extraction', async () => {
    let backgroundTask: Promise<unknown> | null = null;
    const neverCompletes = new Promise(() => undefined);
    const context = {
      app: {
        config: { storyboard: {} },
      },
      pool: {
        query: async () => [
          [
            {
              id: 19,
              name: '项目',
              description: '',
              video_url: '/generated/project-videos/project-19.mp4',
              video_status: GENERATION_STATUS.SUCCEEDED,
              video_poster_url: '',
            },
          ],
        ],
      },
      ctx: {
        runInBackground: (task: Promise<unknown>) => {
          backgroundTask = task;
        },
      },
      backfillMissingPosters: () => neverCompletes,
    };
    const projects = await ProjectService.prototype.findAll.call(context, 1);
    assert.equal(projects.length, 1);
    assert.equal(backgroundTask, neverCompletes);
  });

  it('derives a cache-safe poster name from the composed video', () => {
    assert.equal(
      ProjectVideoPosterService.prototype.buildBaseName(
        19,
        '/generated/project-videos/project-19-1720000000000.mp4',
      ),
      'project-19-1720000000000-poster',
    );
  });

  it('keeps a successful project video usable when poster extraction fails', async () => {
    let warning = '';
    const context = {
      backfillState: {
        inFlight: new Map(),
        retryAfter: new Map(),
      },
      ensureForProject: async () => {
        throw new Error('ffmpeg failed');
      },
      ctx: {
        logger: {
          warn: (...args: unknown[]) => {
            warning = args.join(' ');
          },
        },
      },
    };
    const posterUrl = await ProjectVideoPosterService.prototype.ensureBestEffort.call(context, {
      id: 19,
      video_url: '/generated/project-videos/project-19.mp4',
      video_status: GENERATION_STATUS.SUCCEEDED,
    });
    assert.equal(posterUrl, '');
    assert.match(warning, /ffmpeg failed/);
  });

  it('backs off after a failed extraction instead of retrying every project-list request', async () => {
    let attempts = 0;
    const state = {
      inFlight: new Map(),
      retryAfter: new Map(),
    };
    const context = {
      backfillState: state,
      ensureForProject: async () => {
        attempts++;
        throw new Error('download timeout');
      },
      ctx: {
        logger: { warn: () => undefined },
      },
    };
    const project = {
      id: 30,
      video_url: '/generated/project-videos/project-30.mp4',
      video_status: GENERATION_STATUS.SUCCEEDED,
    };
    await ProjectVideoPosterService.prototype.ensureBestEffort.call(context, project);
    await ProjectVideoPosterService.prototype.ensureBestEffort.call(context, project);
    assert.equal(attempts, 1);
    assert.ok(Number(state.retryAfter.get(30)) > Date.now());
  });

  it('persists a missing poster without overwriting an existing value', async () => {
    let sql = '';
    let params: unknown[] = [];
    const context = {
      extract: async () => '/generated/project-video-posters/project-19.webp',
      app: {
        mysqlPool: {
          execute: async (nextSql: string, nextParams: unknown[]) => {
            sql = nextSql;
            params = nextParams;
          },
        },
      },
    };
    const posterUrl = await ProjectVideoPosterService.prototype.ensureForProject.call(context, {
      id: 19,
      video_url: '/generated/project-videos/project-19.mp4',
      video_status: GENERATION_STATUS.SUCCEEDED,
      video_poster_url: '',
    });
    assert.equal(posterUrl, '/generated/project-video-posters/project-19.webp');
    assert.match(sql, /COALESCE\(video_poster_url, ''\) = ''/);
    assert.deepStrictEqual(params, ['/generated/project-video-posters/project-19.webp', 19]);
  });
});
