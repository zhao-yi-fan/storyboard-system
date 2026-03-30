package repository

import (
	"database/sql"
	"storyboard-backend/database"
	"storyboard-backend/models"
)

// ChapterRepository handles database operations for chapters
type ChapterRepository struct{}

// FindByProjectID finds all chapters for a project
func (r *ChapterRepository) FindByProjectID(projectID int64) ([]models.Chapter, error) {
	query := `SELECT id, project_id, title, summary, sort_order, created_at, updated_at 
	          FROM chapters WHERE project_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC, id ASC`
	
	rows, err := database.DB.Query(query, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chapters []models.Chapter
	for rows.Next() {
		var c models.Chapter
		if err := rows.Scan(&c.ID, &c.ProjectID, &c.Title, &c.Summary, &c.SortOrder, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		chapters = append(chapters, c)
	}

	return chapters, nil
}

// FindByID finds a chapter by ID
func (r *ChapterRepository) FindByID(id int64) (*models.Chapter, error) {
	query := `SELECT id, project_id, title, summary, sort_order, created_at, updated_at 
	          FROM chapters WHERE id = ? AND deleted_at IS NULL`
	
	var c models.Chapter
	err := database.DB.QueryRow(query, id).Scan(&c.ID, &c.ProjectID, &c.Title, &c.Summary, &c.SortOrder, &c.CreatedAt, &c.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// Create creates a new chapter
func (r *ChapterRepository) Create(c *models.Chapter) error {
	query := `INSERT INTO chapters (project_id, title, summary, sort_order) VALUES (?, ?, ?, ?)`
	
	result, err := database.DB.Exec(query, c.ProjectID, c.Title, c.Summary, c.SortOrder)
	if err != nil {
		return err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	c.ID = id
	return nil
}

// Update updates a chapter
func (r *ChapterRepository) Update(c *models.Chapter) error {
	query := `UPDATE chapters SET title = ?, summary = ?, sort_order = ? WHERE id = ?`
	
	_, err := database.DB.Exec(query, c.Title, c.Summary, c.SortOrder, c.ID)
	return err
}

// Delete soft deletes a chapter
func (r *ChapterRepository) Delete(id int64) error {
	query := `UPDATE chapters SET deleted_at = NOW() WHERE id = ?`
	_, err := database.DB.Exec(query, id)
	return err
}

// GetMaxSortOrder returns the maximum sort order for a project
func (r *ChapterRepository) GetMaxSortOrder(projectID int64) (int, error) {
	var maxSort int
	query := `SELECT COALESCE(MAX(sort_order), 0) FROM chapters WHERE project_id = ? AND deleted_at IS NULL`
	err := database.DB.QueryRow(query, projectID).Scan(&maxSort)
	return maxSort, err
}
