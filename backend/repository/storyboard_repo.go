package repository

import (
	"database/sql"

	"storyboard-backend/database"
	"storyboard-backend/models"
)

// StoryboardRepository handles database operations for storyboards
type StoryboardRepository struct{}

// FindBySceneID finds all storyboards for a scene
func (r *StoryboardRepository) FindBySceneID(sceneID int64) ([]models.Storyboard, error) {
	query := `SELECT id, scene_id, chapter_id, project_id, shot_number, content, dialogue, shot_type, mood, camera_direction, camera_motion,
	          duration, background, thumbnail_url, thumbnail_preview_url, video_url, video_preview_url, video_status, video_error, video_duration, notes, sort_order, created_at, updated_at
	          FROM storyboards WHERE scene_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC, id ASC`

	rows, err := database.DB.Query(query, sceneID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var storyboards []models.Storyboard
	for rows.Next() {
		var sb models.Storyboard
		var dialogue sql.NullString
		var shotType sql.NullString
		var mood sql.NullString
		var cameraMotion sql.NullString
		var thumbnailURL sql.NullString
		var thumbnailPreviewURL sql.NullString
		var videoURL sql.NullString
		var videoPreviewURL sql.NullString
		var videoStatus sql.NullString
		var videoError sql.NullString
		var videoDuration sql.NullFloat64
		if err := rows.Scan(&sb.ID, &sb.SceneID, &sb.ChapterID, &sb.ProjectID, &sb.ShotNumber, &sb.Content, &dialogue, &shotType, &mood, &sb.CameraDirection, &cameraMotion,
			&sb.Duration, &sb.Background, &thumbnailURL, &thumbnailPreviewURL, &videoURL, &videoPreviewURL, &videoStatus, &videoError, &videoDuration, &sb.Notes, &sb.SortOrder, &sb.CreatedAt, &sb.UpdatedAt); err != nil {
			return nil, err
		}
		sb.Dialogue = nullStringValue(dialogue)
		sb.ShotType = nullStringValue(shotType)
		sb.Mood = nullStringValue(mood)
		sb.CameraMotion = nullStringValue(cameraMotion)
		sb.ThumbnailURL = nullStringValue(thumbnailURL)
		sb.ThumbnailPreviewURL = nullStringValue(thumbnailPreviewURL)
		sb.VideoURL = nullStringValue(videoURL)
		sb.VideoPreviewURL = nullStringValue(videoPreviewURL)
		sb.VideoStatus = nullStringValue(videoStatus)
		sb.VideoError = nullStringValue(videoError)
		sb.VideoDuration = nullFloat64Value(videoDuration)
		storyboards = append(storyboards, sb)
	}

	if err := r.attachCharacterNames(storyboards); err != nil {
		return nil, err
	}

	return storyboards, nil
}

// FindByID finds a storyboard by ID
func (r *StoryboardRepository) FindByID(id int64) (*models.Storyboard, error) {
	query := `SELECT id, scene_id, chapter_id, project_id, shot_number, content, dialogue, shot_type, mood, camera_direction, camera_motion,
	          duration, background, thumbnail_url, thumbnail_preview_url, video_url, video_preview_url, video_status, video_error, video_duration, notes, sort_order, created_at, updated_at
	          FROM storyboards WHERE id = ? AND deleted_at IS NULL`

	var sb models.Storyboard
	var dialogue sql.NullString
	var shotType sql.NullString
	var mood sql.NullString
	var cameraMotion sql.NullString
	var thumbnailURL sql.NullString
	var thumbnailPreviewURL sql.NullString
	var videoURL sql.NullString
	var videoPreviewURL sql.NullString
	var videoStatus sql.NullString
	var videoError sql.NullString
	var videoDuration sql.NullFloat64
	err := database.DB.QueryRow(query, id).Scan(&sb.ID, &sb.SceneID, &sb.ChapterID, &sb.ProjectID, &sb.ShotNumber, &sb.Content, &dialogue, &shotType, &mood, &sb.CameraDirection, &cameraMotion,
		&sb.Duration, &sb.Background, &thumbnailURL, &thumbnailPreviewURL, &videoURL, &videoPreviewURL, &videoStatus, &videoError, &videoDuration, &sb.Notes, &sb.SortOrder, &sb.CreatedAt, &sb.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	sb.Dialogue = nullStringValue(dialogue)
	sb.ShotType = nullStringValue(shotType)
	sb.Mood = nullStringValue(mood)
	sb.CameraMotion = nullStringValue(cameraMotion)
	sb.ThumbnailURL = nullStringValue(thumbnailURL)
	sb.ThumbnailPreviewURL = nullStringValue(thumbnailPreviewURL)
	sb.VideoURL = nullStringValue(videoURL)
	sb.VideoPreviewURL = nullStringValue(videoPreviewURL)
	sb.VideoStatus = nullStringValue(videoStatus)
	sb.VideoError = nullStringValue(videoError)
	sb.VideoDuration = nullFloat64Value(videoDuration)

	if err := r.attachCharacterNamesToPointers([]*models.Storyboard{&sb}); err != nil {
		return nil, err
	}
	return &sb, nil
}

func (r *StoryboardRepository) attachCharacterNames(storyboards []models.Storyboard) error {
	if len(storyboards) == 0 {
		return nil
	}

	ids := make([]any, 0, len(storyboards))
	index := make(map[int64]*models.Storyboard, len(storyboards))
	placeholders := make([]byte, 0, len(storyboards)*2)
	for i := range storyboards {
		id := storyboards[i].ID
		ids = append(ids, id)
		index[id] = &storyboards[i]
		if i > 0 {
			placeholders = append(placeholders, ',', '?')
		} else {
			placeholders = append(placeholders, '?')
		}
	}

	query := `SELECT sc.storyboard_id, c.id, c.project_id, c.name, c.description, c.avatar_url, c.avatar_preview_url, c.created_at, c.updated_at
		FROM storyboard_characters sc
		JOIN characters c ON c.id = sc.character_id
		WHERE sc.storyboard_id IN (` + string(placeholders) + `)
		ORDER BY sc.storyboard_id ASC, c.id ASC`

	rows, err := database.DB.Query(query, ids...)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var storyboardID int64
		var character models.Character
		var avatarURL sql.NullString
		var avatarPreviewURL sql.NullString
		if err := rows.Scan(
			&storyboardID,
			&character.ID,
			&character.ProjectID,
			&character.Name,
			&character.Description,
			&avatarURL,
			&avatarPreviewURL,
			&character.CreatedAt,
			&character.UpdatedAt,
		); err != nil {
			return err
		}
		character.AvatarURL = nullStringValue(avatarURL)
		character.AvatarPreviewURL = nullStringValue(avatarPreviewURL)

		if sb, ok := index[storyboardID]; ok {
			sb.Characters = append(sb.Characters, character)
			sb.CharacterNames = append(sb.CharacterNames, character.Name)
		}
	}

	return rows.Err()
}

func (r *StoryboardRepository) attachCharacterNamesToPointers(storyboards []*models.Storyboard) error {
	if len(storyboards) == 0 {
		return nil
	}

	ids := make([]any, 0, len(storyboards))
	index := make(map[int64]*models.Storyboard, len(storyboards))
	placeholders := make([]byte, 0, len(storyboards)*2)
	for _, storyboard := range storyboards {
		if storyboard == nil {
			continue
		}
		id := storyboard.ID
		ids = append(ids, id)
		index[id] = storyboard
		if len(ids) > 1 {
			placeholders = append(placeholders, ',', '?')
		} else {
			placeholders = append(placeholders, '?')
		}
	}

	if len(ids) == 0 {
		return nil
	}

	query := `SELECT sc.storyboard_id, c.id, c.project_id, c.name, c.description, c.avatar_url, c.avatar_preview_url, c.created_at, c.updated_at
		FROM storyboard_characters sc
		JOIN characters c ON c.id = sc.character_id
		WHERE sc.storyboard_id IN (` + string(placeholders) + `)
		ORDER BY sc.storyboard_id ASC, c.id ASC`

	rows, err := database.DB.Query(query, ids...)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var storyboardID int64
		var character models.Character
		var avatarURL sql.NullString
		var avatarPreviewURL sql.NullString
		if err := rows.Scan(
			&storyboardID,
			&character.ID,
			&character.ProjectID,
			&character.Name,
			&character.Description,
			&avatarURL,
			&avatarPreviewURL,
			&character.CreatedAt,
			&character.UpdatedAt,
		); err != nil {
			return err
		}
		character.AvatarURL = nullStringValue(avatarURL)
		character.AvatarPreviewURL = nullStringValue(avatarPreviewURL)

		if sb, ok := index[storyboardID]; ok {
			sb.Characters = append(sb.Characters, character)
			sb.CharacterNames = append(sb.CharacterNames, character.Name)
		}
	}

	return rows.Err()
}

// Create creates a new storyboard
func (r *StoryboardRepository) Create(sb *models.Storyboard) error {
	query := `INSERT INTO storyboards (scene_id, chapter_id, project_id, shot_number, content, dialogue, shot_type, mood,
	          camera_direction, camera_motion, duration, background, thumbnail_url, thumbnail_preview_url, video_url, video_preview_url, video_status, video_error, video_duration, notes, sort_order)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	result, err := database.DB.Exec(query, sb.SceneID, sb.ChapterID, sb.ProjectID, sb.ShotNumber, sb.Content, sb.Dialogue, sb.ShotType, sb.Mood,
		sb.CameraDirection, sb.CameraMotion, sb.Duration, sb.Background, sb.ThumbnailURL, sb.ThumbnailPreviewURL, sb.VideoURL, sb.VideoPreviewURL, sb.VideoStatus, sb.VideoError, sb.VideoDuration, sb.Notes, sb.SortOrder)
	if err != nil {
		return err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	sb.ID = id
	return nil
}

// Update updates a storyboard
func (r *StoryboardRepository) Update(sb *models.Storyboard) error {
	query := `UPDATE storyboards SET shot_number = ?, content = ?, dialogue = ?, shot_type = ?, mood = ?, camera_direction = ?, camera_motion = ?, duration = ?,
	          background = ?, thumbnail_url = ?, thumbnail_preview_url = ?, video_url = ?, video_preview_url = ?, video_status = ?, video_error = ?, video_duration = ?, notes = ?, sort_order = ? WHERE id = ?`

	_, err := database.DB.Exec(query, sb.ShotNumber, sb.Content, sb.Dialogue, sb.ShotType, sb.Mood, sb.CameraDirection, sb.CameraMotion, sb.Duration,
		sb.Background, sb.ThumbnailURL, sb.ThumbnailPreviewURL, sb.VideoURL, sb.VideoPreviewURL, sb.VideoStatus, sb.VideoError, sb.VideoDuration, sb.Notes, sb.SortOrder, sb.ID)
	return err
}

// Delete soft deletes a storyboard
func (r *StoryboardRepository) Delete(id int64) error {
	query := `UPDATE storyboards SET deleted_at = NOW() WHERE id = ?`
	_, err := database.DB.Exec(query, id)
	return err
}

// GetMaxSortOrder returns the maximum sort order for a scene
func (r *StoryboardRepository) GetMaxSortOrder(sceneID int64) (int, error) {
	var maxSort int
	query := `SELECT COALESCE(MAX(sort_order), 0) FROM storyboards WHERE scene_id = ? AND deleted_at IS NULL`
	err := database.DB.QueryRow(query, sceneID).Scan(&maxSort)
	return maxSort, err
}

func nullStringValue(value sql.NullString) string {
	if value.Valid {
		return value.String
	}
	return ""
}

func nullFloat64Value(value sql.NullFloat64) float64 {
	if value.Valid {
		return value.Float64
	}
	return 0
}
