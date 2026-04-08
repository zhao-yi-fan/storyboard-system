package repository

import (
	"database/sql"
	"storyboard-backend/database"
	"storyboard-backend/models"
)

// SceneRepository handles database operations for scenes
type SceneRepository struct{}

// FindByChapterID finds all scenes for a chapter
func (r *SceneRepository) FindByChapterID(chapterID int64) ([]models.Scene, error) {
	query := `SELECT id, chapter_id, project_id, title, description, location, time_of_day, cover_url, cover_preview_url, video_url, video_preview_url, video_status, video_error, video_duration, sort_order, created_at, updated_at
	          FROM scenes WHERE chapter_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC, id ASC`

	rows, err := database.DB.Query(query, chapterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var scenes []models.Scene
	for rows.Next() {
		var s models.Scene
		var coverURL sql.NullString
		var coverPreviewURL sql.NullString
		var videoURL sql.NullString
		var videoPreviewURL sql.NullString
		var videoStatus sql.NullString
		var videoError sql.NullString
		var videoDuration sql.NullFloat64
		if err := rows.Scan(&s.ID, &s.ChapterID, &s.ProjectID, &s.Title, &s.Description, &s.Location, &s.TimeOfDay, &coverURL, &coverPreviewURL, &videoURL, &videoPreviewURL, &videoStatus, &videoError, &videoDuration, &s.SortOrder, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		s.CoverURL = nullStringValue(coverURL)
		s.CoverPreviewURL = nullStringValue(coverPreviewURL)
		s.VideoURL = nullStringValue(videoURL)
		s.VideoPreviewURL = nullStringValue(videoPreviewURL)
		s.VideoStatus = nullStringValue(videoStatus)
		s.VideoError = nullStringValue(videoError)
		if videoDuration.Valid {
			s.VideoDuration = videoDuration.Float64
		}
		scenes = append(scenes, s)
	}

	return scenes, nil
}

// FindByID finds a scene by ID
func (r *SceneRepository) FindByID(id int64) (*models.Scene, error) {
	query := `SELECT id, chapter_id, project_id, title, description, location, time_of_day, cover_url, cover_preview_url, video_url, video_preview_url, video_status, video_error, video_duration, sort_order, created_at, updated_at
	          FROM scenes WHERE id = ? AND deleted_at IS NULL`

	var s models.Scene
	var coverURL sql.NullString
	var coverPreviewURL sql.NullString
	var videoURL sql.NullString
	var videoPreviewURL sql.NullString
	var videoStatus sql.NullString
	var videoError sql.NullString
	var videoDuration sql.NullFloat64
	err := database.DB.QueryRow(query, id).Scan(&s.ID, &s.ChapterID, &s.ProjectID, &s.Title, &s.Description, &s.Location, &s.TimeOfDay, &coverURL, &coverPreviewURL, &videoURL, &videoPreviewURL, &videoStatus, &videoError, &videoDuration, &s.SortOrder, &s.CreatedAt, &s.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	s.CoverURL = nullStringValue(coverURL)
	s.CoverPreviewURL = nullStringValue(coverPreviewURL)
	s.VideoURL = nullStringValue(videoURL)
	s.VideoPreviewURL = nullStringValue(videoPreviewURL)
	s.VideoStatus = nullStringValue(videoStatus)
	s.VideoError = nullStringValue(videoError)
	if videoDuration.Valid {
		s.VideoDuration = videoDuration.Float64
	}
	return &s, nil
}

// Create creates a new scene
func (r *SceneRepository) Create(s *models.Scene) error {
	query := `INSERT INTO scenes (chapter_id, project_id, title, description, location, time_of_day, cover_url, cover_preview_url, video_url, video_preview_url, video_status, video_error, video_duration, sort_order)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	result, err := database.DB.Exec(query, s.ChapterID, s.ProjectID, s.Title, s.Description, s.Location, s.TimeOfDay, normalizeNullableString(s.CoverURL), normalizeNullableString(s.CoverPreviewURL), normalizeNullableString(s.VideoURL), normalizeNullableString(s.VideoPreviewURL), normalizeNullableString(s.VideoStatus), normalizeNullableString(s.VideoError), normalizeNullableSceneFloat64(s.VideoDuration), s.SortOrder)
	if err != nil {
		return err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	s.ID = id
	return nil
}

// Update updates a scene
func (r *SceneRepository) Update(s *models.Scene) error {
	query := `UPDATE scenes SET title = ?, description = ?, location = ?, time_of_day = ?, cover_url = ?, cover_preview_url = ?, video_url = ?, video_preview_url = ?, video_status = ?, video_error = ?, video_duration = ?, sort_order = ? WHERE id = ?`

	_, err := database.DB.Exec(query, s.Title, s.Description, s.Location, s.TimeOfDay, normalizeNullableString(s.CoverURL), normalizeNullableString(s.CoverPreviewURL), normalizeNullableString(s.VideoURL), normalizeNullableString(s.VideoPreviewURL), normalizeNullableString(s.VideoStatus), normalizeNullableString(s.VideoError), normalizeNullableSceneFloat64(s.VideoDuration), s.SortOrder, s.ID)
	return err
}

// Delete soft deletes a scene
func (r *SceneRepository) Delete(id int64) error {
	query := `UPDATE scenes SET deleted_at = NOW() WHERE id = ?`
	_, err := database.DB.Exec(query, id)
	return err
}

// GetMaxSortOrder returns the maximum sort order for a chapter
func (r *SceneRepository) GetMaxSortOrder(chapterID int64) (int, error) {
	var maxSort int
	query := `SELECT COALESCE(MAX(sort_order), 0) FROM scenes WHERE chapter_id = ? AND deleted_at IS NULL`
	err := database.DB.QueryRow(query, chapterID).Scan(&maxSort)
	return maxSort, err
}

func normalizeNullableSceneFloat64(value float64) any {
	if value <= 0 {
		return nil
	}
	return value
}
