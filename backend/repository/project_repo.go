package repository

import (
	"database/sql"
	"storyboard-backend/database"
	"storyboard-backend/models"
)

// ProjectRepository handles database operations for projects
type ProjectRepository struct{}

// FindAll returns all non-deleted projects with statistics
func (r *ProjectRepository) FindAll() ([]models.ProjectWithStats, error) {
	query := `SELECT id, name, description, script_text, created_at, updated_at 
	          FROM projects WHERE deleted_at IS NULL ORDER BY created_at DESC`
	
	rows, err := database.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []models.ProjectWithStats
	for rows.Next() {
		var p models.Project
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.ScriptText, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}

		// Get statistics
		chapterCount, _ := r.CountChapters(p.ID)
		sceneCount, _ := r.CountScenes(p.ID)
		storyboardCount, _ := r.CountStoryboards(p.ID)

		projects = append(projects, models.ProjectWithStats{
			Project: p,
			ChapterCount: chapterCount,
			SceneCount: sceneCount,
			StoryboardCount: storyboardCount,
		})
	}

	return projects, nil
}

// FindByID finds a project by ID
func (r *ProjectRepository) FindByID(id int64) (*models.Project, error) {
	query := `SELECT id, name, description, script_text, created_at, updated_at 
	          FROM projects WHERE id = ? AND deleted_at IS NULL`
	
	var p models.Project
	err := database.DB.QueryRow(query, id).Scan(&p.ID, &p.Name, &p.Description, &p.ScriptText, &p.CreatedAt, &p.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
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

// UpdateScriptText updates the script text
func (r *ProjectRepository) UpdateScriptText(id int64, scriptText string) error {
	query := `UPDATE projects SET script_text = ? WHERE id = ?`
	_, err := database.DB.Exec(query, scriptText, id)
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
