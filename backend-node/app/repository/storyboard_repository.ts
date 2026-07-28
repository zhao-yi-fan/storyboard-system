import type { Pool, RowDataPacket } from 'mysql2/promise';

export type StoryboardSceneRow = RowDataPacket & {
  id: number;
  chapter_id: number;
  project_id: number;
};

export type StoryboardRow = RowDataPacket & {
  id: number;
  scene_id: number;
  chapter_id: number;
  project_id: number;
};

const STORYBOARD_SELECT = `SELECT id, scene_id, chapter_id, project_id, shot_number, content, dialogue, shot_type, mood, style_preset, style_notes,
              camera_direction, camera_motion, duration, background, thumbnail_url, thumbnail_preview_url, video_url,
              video_preview_url, video_status, video_error, video_duration, notes, sort_order, created_at, updated_at
       FROM storyboards`;

export class StoryboardRepository {
  constructor(private readonly pool: Pool) {}

  async findSceneById(id: number): Promise<StoryboardSceneRow | null> {
    const [rows] = await this.pool.query<StoryboardSceneRow[]>(
      'SELECT id, chapter_id, project_id FROM scenes WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    return rows[0] || null;
  }

  async findBySceneId(sceneId: number): Promise<StoryboardRow[]> {
    const [rows] = await this.pool.query<StoryboardRow[]>(
      `${STORYBOARD_SELECT}
       WHERE scene_id = ? AND deleted_at IS NULL
       ORDER BY sort_order ASC, id ASC`,
      [sceneId],
    );
    return rows;
  }

  async findById(id: number): Promise<StoryboardRow | null> {
    const [rows] = await this.pool.query<StoryboardRow[]>(
      `${STORYBOARD_SELECT}
       WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] || null;
  }

  async getMaxSortOrder(sceneId: number): Promise<number> {
    const [rows] = await this.pool.query<Array<RowDataPacket & { max_sort: number | string }>>(
      'SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM storyboards WHERE scene_id = ? AND deleted_at IS NULL',
      [sceneId],
    );
    return Number(rows[0]?.max_sort || 0);
  }
}
