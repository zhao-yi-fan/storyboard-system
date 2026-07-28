import type { Pool, RowDataPacket } from 'mysql2/promise';

export type ChapterProjectRow = RowDataPacket & {
  id: number;
  project_id: number;
};

export type SceneRow = RowDataPacket & {
  id: number;
  chapter_id: number;
  project_id: number;
};

export class SceneRepository {
  constructor(private readonly pool: Pool) {}

  async findChapterById(id: number): Promise<ChapterProjectRow | null> {
    const [rows] = await this.pool.query<ChapterProjectRow[]>(
      'SELECT id, project_id FROM chapters WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    return rows[0] || null;
  }

  async findByChapterId(chapterId: number): Promise<SceneRow[]> {
    const [rows] = await this.pool.query<SceneRow[]>(
      `SELECT id, chapter_id, project_id, title, description, prompt, location, time_of_day, style_preset, style_notes,
              cover_url, cover_preview_url, video_url, video_preview_url, video_poster_url, video_status, video_error, video_duration,
              generation_duration, sort_order, created_at, updated_at
       FROM scenes
       WHERE chapter_id = ? AND deleted_at IS NULL
       ORDER BY sort_order ASC, id ASC`,
      [chapterId],
    );
    return rows;
  }

  async findById(id: number): Promise<SceneRow | null> {
    const [rows] = await this.pool.query<SceneRow[]>(
      `SELECT id, chapter_id, project_id, title, description, prompt, location, time_of_day, style_preset, style_notes,
              cover_url, cover_preview_url, video_url, video_preview_url, video_poster_url, video_status, video_error, video_duration,
              generation_duration, sort_order, created_at, updated_at
       FROM scenes
       WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] || null;
  }

  async getMaxSortOrder(chapterId: number): Promise<number> {
    const [rows] = await this.pool.query<Array<RowDataPacket & { max_sort: number | string }>>(
      'SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM scenes WHERE chapter_id = ? AND deleted_at IS NULL',
      [chapterId],
    );
    return Number(rows[0]?.max_sort || 0);
  }
}
