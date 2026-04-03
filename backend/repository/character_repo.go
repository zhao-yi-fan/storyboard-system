package repository

import (
	"database/sql"

	"storyboard-backend/database"
	"storyboard-backend/models"
)

// CharacterRepository handles database operations for characters
type CharacterRepository struct{}

// FindByProjectID finds all characters for a project
func (r *CharacterRepository) FindByProjectID(projectID int64) ([]models.Character, error) {
	query := `SELECT id, project_id, name, description, avatar_url, avatar_preview_url, created_at, updated_at
	          FROM characters WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`

	rows, err := database.DB.Query(query, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var characters []models.Character
	for rows.Next() {
		var c models.Character
		var avatarURL sql.NullString
		var avatarPreviewURL sql.NullString
		if err := rows.Scan(&c.ID, &c.ProjectID, &c.Name, &c.Description, &avatarURL, &avatarPreviewURL, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		c.AvatarURL = nullStringValue(avatarURL)
		c.AvatarPreviewURL = nullStringValue(avatarPreviewURL)
		characters = append(characters, c)
	}

	return characters, nil
}

// FindByID finds a character by ID
func (r *CharacterRepository) FindByID(id int64) (*models.Character, error) {
	query := `SELECT id, project_id, name, description, avatar_url, avatar_preview_url, created_at, updated_at
	          FROM characters WHERE id = ? AND deleted_at IS NULL`

	var c models.Character
	var avatarURL sql.NullString
	var avatarPreviewURL sql.NullString
	err := database.DB.QueryRow(query, id).Scan(&c.ID, &c.ProjectID, &c.Name, &c.Description, &avatarURL, &avatarPreviewURL, &c.CreatedAt, &c.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	c.AvatarURL = nullStringValue(avatarURL)
	c.AvatarPreviewURL = nullStringValue(avatarPreviewURL)
	return &c, nil
}

// Create creates a new character
func (r *CharacterRepository) Create(c *models.Character) error {
	query := `INSERT INTO characters (project_id, name, description, avatar_url, avatar_preview_url) VALUES (?, ?, ?, ?, ?)`

	result, err := database.DB.Exec(query, c.ProjectID, c.Name, c.Description, c.AvatarURL, c.AvatarPreviewURL)
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

// Update updates a character
func (r *CharacterRepository) Update(c *models.Character) error {
	query := `UPDATE characters SET name = ?, description = ?, avatar_url = ?, avatar_preview_url = ? WHERE id = ?`

	_, err := database.DB.Exec(query, c.Name, c.Description, c.AvatarURL, c.AvatarPreviewURL, c.ID)
	return err
}

// Delete soft deletes a character
func (r *CharacterRepository) Delete(id int64) error {
	query := `UPDATE characters SET deleted_at = NOW() WHERE id = ?`
	_, err := database.DB.Exec(query, id)
	return err
}
