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
	query := `SELECT id, chapter_id, project_id, title, description, location, time_of_day, sort_order, created_at, updated_at 
	          FROM scenes WHERE chapter_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC, id ASC`
	
	rows, err := database.DB.Query(query, chapterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var scenes []models.Scene
	for rows.Next() {
		var s models.Scene
		if err := rows.Scan(&s.ID, &s.ChapterID, &s.ProjectID, &s.Title, &s.Description, &s.Location, &s.TimeOfDay, &s.SortOrder, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		scenes = append(scenes, s)
	}

	return scenes, nil
}

// FindByID finds a scene by ID
func (r *SceneRepository) FindByID(id int64) (*models.Scene, error) {
	query := `SELECT id, chapter_id, project_id, title, description, location, time_of_day, sort_order, created_at, updated_at 
	          FROM scenes WHERE id = ? AND deleted_at IS NULL`
	
	var s models.Scene
	err := database.DB.QueryRow(query, id).Scan(&s.ID, &s.ChapterID, &s.ProjectID, &s.Title, &s.Description, &s.Location, &s.TimeOfDay, &s.SortOrder, &s.CreatedAt, &s.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// Create creates a new scene
func (r *SceneRepository) Create(s *models.Scene) error {
	query := `INSERT INTO scenes (chapter_id, project_id, title, description, location, time_of_day, sort_order) 
	          VALUES (?, ?, ?, ?, ?, ?, ?)`
	
	result, err := database.DB.Exec(query, s.ChapterID, s.ProjectID, s.Title, s.Description, s.Location, s.TimeOfDay, s.SortOrder)
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
	query := `UPDATE scenes SET title = ?, description = ?, location = ?, time_of_day = ?, sort_order = ? WHERE id = ?`
	
	_, err := database.DB.Exec(query, s.Title, s.Description, s.Location, s.TimeOfDay, s.SortOrder, s.ID)
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
