'use strict';

const Service = require('egg').Service;
const { GENERATION_STATUS } = require('../lib/domain_constants');
const path = require('node:path');
const {
  createPreviewFromRemoteSource,
  createPreviewFromSource,
  videoPosterSpec,
} = require('../lib/media');
const { isOssEnabled, resolveUrl } = require('../lib/generated_asset');

const POSTER_RETRY_COOLDOWN_MS = 10 * 60 * 1000;

type ProjectRow = {
  id: number;
  video_poster_url?: string;
  video_status?: string;
  video_url?: string;
};

type BackfillState = {
  inFlight: Map<number, Promise<string>>;
  retryAfter: Map<number, number>;
};

function sanitizeExtractionError(error: unknown): string {
  return String((error as Error)?.message || error).replace(/https?:\/\/\S+/gi, '[media-url]');
}

class ProjectVideoPosterService extends Service {
  get backfillState(): BackfillState {
    if (!(this.app).projectVideoPosterBackfillState) {
      (this.app).projectVideoPosterBackfillState = {
        inFlight: new Map<number, Promise<string>>(),
        retryAfter: new Map<number, number>(),
      };
    }
    return (this.app).projectVideoPosterBackfillState;
  }

  buildBaseName(projectId: number | string, videoUrl: string): string {
    const videoName = path.basename(
      String(videoUrl || '').split(/[?#]/, 1)[0],
      path.extname(String(videoUrl || '').split(/[?#]/, 1)[0]),
    );
    return `${videoName || `project-${Number(projectId)}-video`}-poster`;
  }

  async extract(projectId: number | string, videoUrl: string): Promise<string> {
    if (!Number(projectId) || !videoUrl) {
      throw new Error('project video is required');
    }
    const baseName = this.buildBaseName(projectId, videoUrl);
    if (isOssEnabled(this.app)) {
      return await createPreviewFromRemoteSource(
        this.app,
        resolveUrl(this.app, videoUrl),
        'project-video-posters',
        baseName,
        videoPosterSpec(),
      );
    }
    return await createPreviewFromSource(
      this.app,
      videoUrl,
      'project-video-posters',
      baseName,
      videoPosterSpec(),
    );
  }

  async ensureForProject(project: ProjectRow): Promise<string> {
    if (project?.video_poster_url) return project.video_poster_url;
    if (project?.video_status !== GENERATION_STATUS.SUCCEEDED || !project?.video_url) {
      throw new Error('only a successful project video can create a poster');
    }
    const posterUrl = await this.extract(project.id, project.video_url);
    await (this.app).mysqlPool.execute(
      `UPDATE projects SET video_poster_url = ?
       WHERE id = ? AND deleted_at IS NULL AND COALESCE(video_poster_url, '') = ''`,
      [posterUrl, project.id],
    );
    return posterUrl;
  }

  async ensureBestEffort(project: ProjectRow, options: { force?: boolean } = {}): Promise<string> {
    const projectId = Number(project?.id || 0);
    const force = Boolean(options.force);
    if (!projectId) return '';

    const existingTask = this.backfillState.inFlight.get(projectId);
    if (existingTask !== undefined) return await existingTask;
    if (!force && Number(this.backfillState.retryAfter.get(projectId) || 0) > Date.now()) {
      return '';
    }

    const task = this.ensureForProject(project)
      .then((posterUrl: string) => {
        this.backfillState.retryAfter.delete(projectId);
        return posterUrl;
      })
      .catch((error: unknown) => {
        this.backfillState.retryAfter.set(projectId, Date.now() + POSTER_RETRY_COOLDOWN_MS);
        (this.ctx).logger.warn(
          '[video-poster] project=%s extraction failed: %s',
          projectId,
          sanitizeExtractionError(error),
        );
        return '';
      })
      .finally(() => {
        this.backfillState.inFlight.delete(projectId);
      });
    this.backfillState.inFlight.set(projectId, task);
    return await task;
  }
}

module.exports = ProjectVideoPosterService;
