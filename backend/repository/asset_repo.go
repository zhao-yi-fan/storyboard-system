package repository

import (
	"database/sql"
	"storyboard-backend/database"
	"storyboard-backend/models"
)

// AssetRepository handles database operations for assets
type AssetRepository struct{}

// FindByProjectID finds all assets for a project
func (r *AssetRepository) FindByProjectID(projectID int64) ([]models.Asset, error) {
	query := `SELECT id, project_id, character_id, name, type, file_url, thumbnail_url, meta, created_at, updated_at 
	          FROM assets WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`
	
	rows, err := database.DB.Query(query, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	assets := make([]models.Asset, 0)
	for rows.Next() {
		var a models.Asset
		if err := rows.Scan(&a.ID, &a.ProjectID, &a.CharacterID, &a.Name, &a.Type, &a.FileURL, &a.ThumbnailURL, &a.Meta, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		assets = append(assets, a)
	}

	return assets, nil
}

// FindByCharacterID finds all assets for a character
func (r *AssetRepository) FindByCharacterID(characterID int64) ([]models.Asset, error) {
	query := `SELECT id, project_id, character_id, name, type, file_url, thumbnail_url, meta, created_at, updated_at 
	          FROM assets WHERE character_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`
	
	rows, err := database.DB.Query(query, characterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	assets := make([]models.Asset, 0)
	for rows.Next() {
		var a models.Asset
		if err := rows.Scan(&a.ID, &a.ProjectID, &a.CharacterID, &a.Name, &a.Type, &a.FileURL, &a.ThumbnailURL, &a.Meta, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		assets = append(assets, a)
	}

	return assets, nil
}

// FindByID finds an asset by ID
func (r *AssetRepository) FindByID(id int64) (*models.Asset, error) {
	query := `SELECT id, project_id, character_id, name, type, file_url, thumbnail_url, meta, created_at, updated_at 
	          FROM assets WHERE id = ? AND deleted_at IS NULL`
	
	var a models.Asset
	err := database.DB.QueryRow(query, id).Scan(&a.ID, &a.ProjectID, &a.CharacterID, &a.Name, &a.Type, &a.FileURL, &a.ThumbnailURL, &a.Meta, &a.CreatedAt, &a.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// Create creates a new asset
func (r *AssetRepository) Create(a *models.Asset) error {
	query := `INSERT INTO assets (project_id, character_id, name, type, file_url, thumbnail_url, meta) 
	          VALUES (?, ?, ?, ?, ?, ?, ?)`
	
	result, err := database.DB.Exec(query, a.ProjectID, a.CharacterID, a.Name, a.Type, a.FileURL, a.ThumbnailURL, a.Meta)
	if err != nil {
		return err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	a.ID = id
	return nil
}

// Delete soft deletes an asset
func (r *AssetRepository) Delete(id int64) error {
	query := `UPDATE assets SET deleted_at = NOW() WHERE id = ?`
	_, err := database.DB.Exec(query, id)
	return err
}
