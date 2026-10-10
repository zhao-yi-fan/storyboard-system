'use strict';

const Service = require('egg').Service;
const crypto = require('node:crypto');
const { parseMediaGenerationMeta } = require('../lib/media_generation_meta');
const {
  generatedPublicPath,
  isGeneratedAssetPath,
  normalizeGeneratedAssetReference,
} = require('../lib/generated_asset');
const { resolveMediaUrl } = require('../lib/media');

class LocalVideoJobService extends Service {
  get pool() {
    return this.app.mysqlPool;
  }

  async transaction(action: (conn: any) => Promise<any>) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await action(conn);
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async create(sceneId: number, preview: any) {
    await this.transaction(async (conn) => {
      const [scenes] = await conn.query(
        `SELECT s.*,p.user_id FROM scenes s JOIN projects p ON p.id=s.project_id
        WHERE s.id=? AND s.deleted_at IS NULL AND p.deleted_at IS NULL FOR UPDATE`,
        [sceneId],
      );
      const scene = scenes[0];
      if (!scene || Number(scene.user_id) !== this.app.config.storyboard.localWorkerOwnerId)
        throw new Error('当前项目未绑定本地生成电脑');
      if (scene.video_status === 'generating') return;
      const source = preview.use_first_frame
        ? normalizeGeneratedAssetReference(this.app, scene.cover_url || '')
        : '';
      if (source && !isGeneratedAssetPath(this.app, source))
        throw new Error('首帧必须是平台已保存的图片');
      const input = {
        prompt: preview.final_prompt,
        duration: preview.duration,
        resolution: preview.resolution,
        aspect_ratio: preview.aspect_ratio,
        use_first_frame: preview.use_first_frame,
        source_image: source,
      };
      const meta = {
        ...input,
        prompt: undefined,
        requested_duration: preview.duration,
        audio: true,
      };
      const [generation] = await conn.execute(
        `INSERT INTO scene_media_generations
        (scene_id,media_type,model,status,source_url,meta_json,is_current)
        VALUES (?,'video',?,'generating',?,?,0)`,
        [sceneId, preview.model, source || null, JSON.stringify(meta)],
      );
      await conn.execute(
        "UPDATE local_video_jobs SET status='superseded' WHERE scene_id=? AND status IN ('queued','generating','uploading')",
        [sceneId],
      );
      await conn.execute(
        'INSERT INTO local_video_jobs (scene_id,generation_id,owner_id,input_json) VALUES (?,?,?,?)',
        [sceneId, generation.insertId, scene.user_id, JSON.stringify(input)],
      );
      await conn.execute(
        "UPDATE scenes SET generation_duration=?,video_status='generating',video_error='' WHERE id=?",
        [preview.duration, sceneId],
      );
    });
    return { scene_id: sceneId, scene: await this.ctx.service.scene.findById(sceneId) };
  }

  async latest(sceneId: number) {
    if (!this.app.config.storyboard.localWorkerKey) return null;
    const [rows] = await this.pool.query(
      `SELECT id,status,heartbeat_at,updated_at FROM local_video_jobs
      WHERE scene_id=? AND generation_id=(SELECT MAX(id) FROM scene_media_generations
        WHERE scene_id=? AND media_type='video' AND deleted_at IS NULL) ORDER BY id DESC LIMIT 1`,
      [sceneId, sceneId],
    );
    if (!rows.length) return null;
    const row = rows[0];
    const disconnected =
      ['generating', 'uploading'].includes(row.status) &&
      Date.now() - new Date(row.heartbeat_at).getTime() >
        this.app.config.storyboard.localWorkerLeaseSeconds * 1000;
    return { id: Number(row.id), status: row.status, disconnected };
  }

  async attachToScenes(scenes: any[]) {
    if (!scenes.length || !this.app.config.storyboard.localWorkerKey) return;
    const ids = scenes.map((scene) => Number(scene.id));
    const [rows] = await this.pool.query(
      `SELECT j.id,j.scene_id,j.status,j.heartbeat_at FROM local_video_jobs j
      WHERE j.scene_id IN (${ids.map(() => '?').join(',')}) AND j.generation_id=(
        SELECT MAX(g.id) FROM scene_media_generations g WHERE g.scene_id=j.scene_id
          AND g.media_type='video' AND g.deleted_at IS NULL)`,
      ids,
    );
    const jobs = new Map(
      rows.map((row: any) => [
        Number(row.scene_id),
        {
          id: Number(row.id),
          status: row.status,
          disconnected:
            ['generating', 'uploading'].includes(row.status) &&
            Date.now() - new Date(row.heartbeat_at).getTime() >
              this.app.config.storyboard.localWorkerLeaseSeconds * 1000,
        },
      ]),
    );
    scenes.forEach((scene) => {
      scene.local_video_job = jobs.get(Number(scene.id)) || null;
    });
  }

  async claim() {
    return this.transaction(async (conn) => {
      // The queue lock serializes claimers across Egg processes, not just this process.
      const [rows] = await conn.query(
        `SELECT * FROM local_video_jobs WHERE owner_id=? AND status='queued'
        ORDER BY id LIMIT 1 FOR UPDATE`,
        [this.app.config.storyboard.localWorkerOwnerId],
      );
      if (!rows.length) return null;
      const row = rows[0];
      const token = crypto.randomBytes(32).toString('hex');
      await conn.execute(
        "UPDATE local_video_jobs SET status='generating',claim_token=?,heartbeat_at=NOW() WHERE id=? AND status='queued'",
        [token, row.id],
      );
      return { id: Number(row.id), token, input: parseMediaGenerationMeta(row.input_json) };
    });
  }

  async locked(conn: any, id: number, token: string) {
    if (!Number.isSafeInteger(id) || id <= 0 || !/^[a-f0-9]{64}$/.test(token))
      throw new Error('Invalid task credentials');
    // Every operation that touches scenes locks the scene before the job, as create does.
    const [targets] = await conn.query(
      'SELECT scene_id FROM local_video_jobs WHERE id=? AND owner_id=?',
      [id, this.app.config.storyboard.localWorkerOwnerId],
    );
    if (!targets.length) throw new Error('Task no longer active');
    const [scenes] = await conn.query(
      'SELECT id FROM scenes WHERE id=? AND deleted_at IS NULL FOR UPDATE',
      [targets[0].scene_id],
    );
    if (!scenes.length) throw new Error('Scene removed');
    const [rows] = await conn.query(
      'SELECT * FROM local_video_jobs WHERE id=? AND owner_id=? FOR UPDATE',
      [id, this.app.config.storyboard.localWorkerOwnerId],
    );
    const row = rows[0];
    if (!row || row.claim_token !== token || ['superseded', 'failed'].includes(row.status))
      throw new Error('Task no longer active');
    return row;
  }

  async update(id: number, token: string, stage?: string, promptId?: string) {
    return this.transaction(async (conn) => {
      const row = await this.locked(conn, id, token);
      if (row.status === 'succeeded') return { status: row.status };
      if (stage && !['generating', 'uploading'].includes(stage)) throw new Error('Invalid stage');
      if (promptId && !/^[a-zA-Z0-9-]{1,64}$/.test(promptId)) throw new Error('Invalid prompt ID');
      await conn.execute(
        'UPDATE local_video_jobs SET heartbeat_at=NOW(),status=?,prompt_id=? WHERE id=?',
        [stage || row.status, promptId || row.prompt_id, id],
      );
      return { status: stage || row.status, prompt_id: promptId || row.prompt_id };
    });
  }

  async firstFrame(id: number, token: string) {
    const task = await this.transaction(async (conn) => this.locked(conn, id, token));
    let input = parseMediaGenerationMeta(task.input_json);
    if (!input.source_image && input.use_first_frame) {
      // Preparation happens after the job is durable, so a backend restart never loses it.
      const scene = await this.ctx.service.scene.findById(task.scene_id);
      if (!scene) throw new Error('Scene removed');
      if (!scene.cover_url)
        await this.ctx.service.sceneCover.generateCover(task.scene_id, '', false);
      const ready = await this.ctx.service.scene.findById(task.scene_id);
      const source = normalizeGeneratedAssetReference(this.app, ready?.cover_url || '');
      if (!source) throw new Error('首帧正在准备，请稍后重试');
      await this.transaction(async (conn) => {
        const row = await this.locked(conn, id, token);
        input = { ...parseMediaGenerationMeta(row.input_json), source_image: source };
        await conn.execute('UPDATE local_video_jobs SET input_json=? WHERE id=?', [
          JSON.stringify(input),
          id,
        ]);
        await conn.execute('UPDATE scene_media_generations SET source_url=? WHERE id=?', [
          source,
          row.generation_id,
        ]);
      });
    }
    const source = String(input.source_image || '');
    if (!source || !isGeneratedAssetPath(this.app, source))
      throw new Error('首帧必须是平台已保存的图片');
    return { url: resolveMediaUrl(this.app, source) };
  }

  async sign(id: number, token: string) {
    const key = await this.transaction(async (conn) => {
      const row = await this.locked(conn, id, token);
      if (row.status === 'succeeded') throw new Error('Task already completed');
      const key = row.object_key || `local-videos/${row.generation_id}-${crypto.randomUUID()}.mp4`;
      await conn.execute(
        "UPDATE local_video_jobs SET object_key=?,status='uploading',heartbeat_at=NOW() WHERE id=?",
        [key, id],
      );
      return key;
    });
    return this.ctx.service.oss.signUploadURL(key, 'video/mp4');
  }

  async complete(id: number, token: string, objectKey: string) {
    // Probe the server-assigned object; never trust a supplied URL or duration.
    const [rows] = await this.pool.query('SELECT * FROM local_video_jobs WHERE id=?', [id]);
    const candidate = rows[0];
    if (
      !candidate ||
      candidate.claim_token !== token ||
      candidate.object_key !== objectKey ||
      Number(candidate.owner_id) !== this.app.config.storyboard.localWorkerOwnerId
    )
      throw new Error('Invalid result');
    if (candidate.status === 'succeeded') return { status: 'succeeded' };
    if (candidate.status !== 'uploading') throw new Error('Task no longer active');
    const publicPath = generatedPublicPath(this.app, '', objectKey);
    const { materializeSourceToLocalFile, probeVideoWithAudio } = require('../lib/media');
    const materialized = await materializeSourceToLocalFile(this.app, publicPath);
    let duration: number;
    try {
      duration = await probeVideoWithAudio(materialized.localPath);
    } finally {
      await materialized.cleanup();
    }
    if (!Number.isFinite(duration) || duration <= 0 || duration > 17)
      throw new Error('Invalid video duration');
    const result = await this.transaction(async (conn) => {
      const row = await this.locked(conn, id, token);
      if (row.status === 'succeeded') return { status: 'succeeded' };
      const [scenes] = await conn.query(
        'SELECT id FROM scenes WHERE id=? AND deleted_at IS NULL FOR UPDATE',
        [row.scene_id],
      );
      if (!scenes.length) throw new Error('Scene removed');
      const [newer] = await conn.query(
        'SELECT id FROM scene_media_generations WHERE scene_id=? AND media_type=? AND id>? AND deleted_at IS NULL LIMIT 1',
        [row.scene_id, 'video', row.generation_id],
      );
      if (newer.length) throw new Error('Result superseded by newer generation');
      const [generations] = await conn.query(
        'SELECT meta_json FROM scene_media_generations WHERE id=? AND deleted_at IS NULL FOR UPDATE',
        [row.generation_id],
      );
      if (!generations.length) throw new Error('Generation removed');
      const input = parseMediaGenerationMeta(row.input_json);
      const meta = {
        ...parseMediaGenerationMeta(generations[0].meta_json),
        provider_task_id: row.prompt_id,
        requested_duration: input.duration,
        actual_duration: duration,
      };
      await conn.execute(
        "UPDATE scenes SET video_url=?,video_preview_url=?,video_poster_url='',video_status='succeeded',video_error='',video_duration=? WHERE id=?",
        [publicPath, publicPath, duration, row.scene_id],
      );
      await conn.execute(
        "UPDATE scene_media_generations SET is_current=0 WHERE scene_id=? AND media_type='video'",
        [row.scene_id],
      );
      await conn.execute(
        "UPDATE scene_media_generations SET status='succeeded',result_url=?,preview_url=?,meta_json=?,error_message=NULL,is_current=1 WHERE id=?",
        [publicPath, publicPath, JSON.stringify(meta), row.generation_id],
      );
      await conn.execute(
        "UPDATE local_video_jobs SET status='succeeded',actual_duration=?,heartbeat_at=NOW() WHERE id=?",
        [duration, id],
      );
      return { status: 'succeeded' };
    });
    // Poster failure must not undo a playable video. Conditional write avoids stale posters.
    const generation = await this.ctx.service.sceneMediaGeneration.findById(
      candidate.generation_id,
    );
    const poster = await this.ctx.service.sceneVideoPoster.ensureBestEffort(generation);
    if (poster)
      await this.pool.execute('UPDATE scenes SET video_poster_url=? WHERE id=? AND video_url=?', [
        normalizeGeneratedAssetReference(this.app, poster),
        candidate.scene_id,
        publicPath,
      ]);
    return result;
  }

  async fail(id: number, token: string, message: string) {
    return this.transaction(async (conn) => {
      const row = await this.locked(conn, id, token);
      if (row.status === 'succeeded') return { status: 'succeeded' };
      const error = String(message || 'Local generation failed').slice(0, 2000);
      const [newer] = await conn.query(
        'SELECT id FROM scene_media_generations WHERE scene_id=? AND media_type=? AND id>? AND deleted_at IS NULL LIMIT 1',
        [row.scene_id, 'video', row.generation_id],
      );
      if (newer.length) throw new Error('Result superseded by newer generation');
      await conn.execute("UPDATE local_video_jobs SET status='failed',error_message=? WHERE id=?", [
        error,
        id,
      ]);
      await conn.execute(
        "UPDATE scene_media_generations SET status='failed',error_message=? WHERE id=?",
        [error, row.generation_id],
      );
      await conn.execute(
        "UPDATE scenes SET video_status='failed',video_error=? WHERE id=? AND video_status='generating'",
        [error, row.scene_id],
      );
      return { status: 'failed' };
    });
  }

  async retry(sceneId: number) {
    const input = await this.transaction(async (conn) => {
      const [scenes] = await conn.query(
        'SELECT id FROM scenes WHERE id=? AND deleted_at IS NULL FOR UPDATE',
        [sceneId],
      );
      if (!scenes.length) throw new Error('Scene removed');
      const [rows] = await conn.query(
        'SELECT * FROM local_video_jobs WHERE scene_id=? ORDER BY id DESC LIMIT 1 FOR UPDATE',
        [sceneId],
      );
      const row = rows[0];
      if (!row || row.status === 'succeeded' || row.status === 'superseded')
        throw new Error('没有可重试的本地任务');
      const [newer] = await conn.query(
        'SELECT id FROM scene_media_generations WHERE scene_id=? AND media_type=? AND id>? AND deleted_at IS NULL LIMIT 1',
        [sceneId, 'video', row.generation_id],
      );
      if (newer.length) throw new Error('Result superseded by newer generation');
      await conn.execute("UPDATE local_video_jobs SET status='superseded' WHERE id=?", [row.id]);
      await conn.execute(
        "UPDATE scene_media_generations SET status='failed',error_message='用户重新提交任务' WHERE id=?",
        [row.generation_id],
      );
      await conn.execute(
        "UPDATE scenes SET video_status='failed',video_error='用户重新提交任务' WHERE id=?",
        [sceneId],
      );
      return parseMediaGenerationMeta(row.input_json);
    });
    return this.ctx.service.sceneVideo.generateVideo(
      sceneId,
      'minimax-h3-local',
      input.duration,
      Boolean(input.use_first_frame || input.source_image),
      input.resolution,
      input.aspect_ratio,
      true,
    );
  }
}

module.exports = LocalVideoJobService;
