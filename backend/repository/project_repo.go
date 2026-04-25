package repository

import (
	"database/sql"
	"time"

	"storyboard-backend/database"
	"storyboard-backend/models"
)

// ProjectRepository handles database operations for projects
type ProjectRepository struct{}

// FindAll returns all non-deleted projects with statistics
func (r *ProjectRepository) FindAll() ([]models.ProjectWithStats, error) {
	query := `SELECT id, name, description, script_text, video_url, video_preview_url, video_status, video_error, video_duration, pinned_at, created_at, updated_at 
	          FROM projects WHERE deleted_at IS NULL ORDER BY CASE WHEN pinned_at IS NULL THEN 1 ELSE 0 END, pinned_at DESC, created_at DESC`

	rows, err := database.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []models.ProjectWithStats
	for rows.Next() {
		var p models.Project
		var videoURL sql.NullString
		var videoPreviewURL sql.NullString
		var videoStatus sql.NullString
		var videoError sql.NullString
		var videoDuration sql.NullFloat64
		var pinnedAt sql.NullTime
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.ScriptText, &videoURL, &videoPreviewURL, &videoStatus, &videoError, &videoDuration, &pinnedAt, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		p.VideoURL = nullStringValue(videoURL)
		p.VideoPreviewURL = nullStringValue(videoPreviewURL)
		p.VideoStatus = nullStringValue(videoStatus)
		p.VideoError = nullStringValue(videoError)
		p.VideoDuration = nullFloat64Value(videoDuration)
		p.PinnedAt = nullTimePtr(pinnedAt)
		p.IsPinned = pinnedAt.Valid

		// Get statistics
		chapterCount, _ := r.CountChapters(p.ID)
		sceneCount, _ := r.CountScenes(p.ID)
		storyboardCount, _ := r.CountStoryboards(p.ID)

		projects = append(projects, models.ProjectWithStats{
			Project:         p,
			ChapterCount:    chapterCount,
			SceneCount:      sceneCount,
			StoryboardCount: storyboardCount,
		})
	}

	return projects, nil
}

// FindByID finds a project by ID
func (r *ProjectRepository) FindByID(id int64) (*models.Project, error) {
	query := `SELECT id, name, description, script_text, video_url, video_preview_url, video_status, video_error, video_duration, pinned_at, created_at, updated_at 
	          FROM projects WHERE id = ? AND deleted_at IS NULL`

	var p models.Project
	var videoURL sql.NullString
	var videoPreviewURL sql.NullString
	var videoStatus sql.NullString
	var videoError sql.NullString
	var videoDuration sql.NullFloat64
	var pinnedAt sql.NullTime
	err := database.DB.QueryRow(query, id).Scan(&p.ID, &p.Name, &p.Description, &p.ScriptText, &videoURL, &videoPreviewURL, &videoStatus, &videoError, &videoDuration, &pinnedAt, &p.CreatedAt, &p.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	p.VideoURL = nullStringValue(videoURL)
	p.VideoPreviewURL = nullStringValue(videoPreviewURL)
	p.VideoStatus = nullStringValue(videoStatus)
	p.VideoError = nullStringValue(videoError)
	p.VideoDuration = nullFloat64Value(videoDuration)
	p.PinnedAt = nullTimePtr(pinnedAt)
	p.IsPinned = pinnedAt.Valid
	return &p, nil
}

// FindByName finds an active project by name
func (r *ProjectRepository) FindByName(name string) (*models.Project, error) {
	query := `SELECT id, name, description, script_text, video_url, video_preview_url, video_status, video_error, video_duration, pinned_at, created_at, updated_at
	          FROM projects WHERE name = ? AND deleted_at IS NULL LIMIT 1`

	var p models.Project
	var videoURL sql.NullString
	var videoPreviewURL sql.NullString
	var videoStatus sql.NullString
	var videoError sql.NullString
	var videoDuration sql.NullFloat64
	var pinnedAt sql.NullTime
	err := database.DB.QueryRow(query, name).Scan(&p.ID, &p.Name, &p.Description, &p.ScriptText, &videoURL, &videoPreviewURL, &videoStatus, &videoError, &videoDuration, &pinnedAt, &p.CreatedAt, &p.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	p.VideoURL = nullStringValue(videoURL)
	p.VideoPreviewURL = nullStringValue(videoPreviewURL)
	p.VideoStatus = nullStringValue(videoStatus)
	p.VideoError = nullStringValue(videoError)
	p.VideoDuration = nullFloat64Value(videoDuration)
	p.PinnedAt = nullTimePtr(pinnedAt)
	p.IsPinned = pinnedAt.Valid
	return &p, nil
}

// FindByNameExceptID finds an active project by name excluding the specified ID
func (r *ProjectRepository) FindByNameExceptID(name string, id int64) (*models.Project, error) {
	query := `SELECT id, name, description, script_text, video_url, video_preview_url, video_status, video_error, video_duration, pinned_at, created_at, updated_at
	          FROM projects WHERE name = ? AND id <> ? AND deleted_at IS NULL LIMIT 1`

	var p models.Project
	var videoURL sql.NullString
	var videoPreviewURL sql.NullString
	var videoStatus sql.NullString
	var videoError sql.NullString
	var videoDuration sql.NullFloat64
	var pinnedAt sql.NullTime
	err := database.DB.QueryRow(query, name, id).Scan(&p.ID, &p.Name, &p.Description, &p.ScriptText, &videoURL, &videoPreviewURL, &videoStatus, &videoError, &videoDuration, &pinnedAt, &p.CreatedAt, &p.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	p.VideoURL = nullStringValue(videoURL)
	p.VideoPreviewURL = nullStringValue(videoPreviewURL)
	p.VideoStatus = nullStringValue(videoStatus)
	p.VideoError = nullStringValue(videoError)
	p.VideoDuration = nullFloat64Value(videoDuration)
	p.PinnedAt = nullTimePtr(pinnedAt)
	p.IsPinned = pinnedAt.Valid
	return &p, nil
}

// Create creates a new project
func (r *ProjectRepository) Create(p *models.Project) error {
	query := `INSERT INTO projects (name, description, script_text) VALUES (?, ?, ?)`

	result, err := database.DB.Exec(query, p.Name, p.Description, p.ScriptText)
	if err != nil {
		return err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	p.ID = id
	return nil
}

// Update updates a project
func (r *ProjectRepository) Update(p *models.Project) error {
	query := `UPDATE projects SET name = ?, description = ?, script_text = ? WHERE id = ?`

	_, err := database.DB.Exec(query, p.Name, p.Description, p.ScriptText, p.ID)
	return err
}

// Delete soft deletes a project
func (r *ProjectRepository) Delete(id int64) error {
	query := `UPDATE projects SET deleted_at = NOW() WHERE id = ?`
	_, err := database.DB.Exec(query, id)
	return err
}

func (r *ProjectRepository) Pin(id int64) error {
	_, err := database.DB.Exec(`UPDATE projects SET pinned_at = NOW() WHERE id = ? AND deleted_at IS NULL`, id)
	return err
}

func (r *ProjectRepository) Unpin(id int64) error {
	_, err := database.DB.Exec(`UPDATE projects SET pinned_at = NULL WHERE id = ? AND deleted_at IS NULL`, id)
	return err
}

// UpdateScriptText updates the script text
func (r *ProjectRepository) UpdateScriptText(id int64, scriptText string) error {
	query := `UPDATE projects SET script_text = ? WHERE id = ?`
	_, err := database.DB.Exec(query, scriptText, id)
	return err
}

func (r *ProjectRepository) UpdateVideoFields(id int64, videoURL, videoPreviewURL, videoStatus, videoError string, videoDuration float64) error {
	query := `UPDATE projects SET video_url = ?, video_preview_url = ?, video_status = ?, video_error = ?, video_duration = ? WHERE id = ?`
	_, err := database.DB.Exec(
		query,
		normalizeNullableString(videoURL),
		normalizeNullableString(videoPreviewURL),
		normalizeNullableString(videoStatus),
		normalizeNullableString(videoError),
		normalizeNullableProjectFloat64(videoDuration),
		id,
	)
	return err
}

// CountChapters counts chapters for a project
func (r *ProjectRepository) CountChapters(projectID int64) (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM chapters WHERE project_id = ? AND deleted_at IS NULL`
	err := database.DB.QueryRow(query, projectID).Scan(&count)
	return count, err
}

// CountScenes counts scenes for a project
func (r *ProjectRepository) CountScenes(projectID int64) (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM scenes WHERE project_id = ? AND deleted_at IS NULL`
	err := database.DB.QueryRow(query, projectID).Scan(&count)
	return count, err
}

// CountStoryboards counts storyboards for a project
func (r *ProjectRepository) CountStoryboards(projectID int64) (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM storyboards WHERE project_id = ? AND deleted_at IS NULL`
	err := database.DB.QueryRow(query, projectID).Scan(&count)
	return count, err
}

func normalizeNullableProjectFloat64(value float64) any {
	if value <= 0 {
		return nil
	}
	return value
}

func nullTimePtr(value sql.NullTime) *time.Time {
	if !value.Valid {
		return nil
	}
	v := value.Time
	return &v
}
