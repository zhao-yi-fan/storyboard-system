package repository

import (
	"database/sql"
	"encoding/json"
	"strings"

	"storyboard-backend/database"
	"storyboard-backend/models"
)

// AssetRepository handles database operations for assets
type AssetRepository struct{}

// FindByProjectID finds all assets for a project
func (r *AssetRepository) FindByProjectID(projectID int64) ([]models.Asset, error) {
	query := `SELECT id, project_id, character_id, name, type, file_url, cover_url, thumbnail_url, meta, created_at, updated_at
	          FROM assets WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`

	rows, err := database.DB.Query(query, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	assets := make([]models.Asset, 0)
	for rows.Next() {
		var a models.Asset
		var coverURL sql.NullString
		var thumbnailURL sql.NullString
		var meta sql.NullString
		if err := rows.Scan(&a.ID, &a.ProjectID, &a.CharacterID, &a.Name, &a.Type, &a.FileURL, &coverURL, &thumbnailURL, &meta, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		a.CoverURL = nullStringValue(coverURL)
		a.ThumbnailURL = nullStringValue(thumbnailURL)
		a.Meta = decodeAssetMeta(meta)
		assets = append(assets, a)
	}

	return assets, nil
}

// FindByCharacterID finds all assets for a character
func (r *AssetRepository) FindByCharacterID(characterID int64) ([]models.Asset, error) {
	query := `SELECT id, project_id, character_id, name, type, file_url, cover_url, thumbnail_url, meta, created_at, updated_at
	          FROM assets WHERE character_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`

	rows, err := database.DB.Query(query, characterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	assets := make([]models.Asset, 0)
	for rows.Next() {
		var a models.Asset
		var coverURL sql.NullString
		var thumbnailURL sql.NullString
		var meta sql.NullString
		if err := rows.Scan(&a.ID, &a.ProjectID, &a.CharacterID, &a.Name, &a.Type, &a.FileURL, &coverURL, &thumbnailURL, &meta, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		a.CoverURL = nullStringValue(coverURL)
		a.ThumbnailURL = nullStringValue(thumbnailURL)
		a.Meta = decodeAssetMeta(meta)
		assets = append(assets, a)
	}

	return assets, nil
}

// FindByID finds an asset by ID
func (r *AssetRepository) FindByID(id int64) (*models.Asset, error) {
	query := `SELECT id, project_id, character_id, name, type, file_url, cover_url, thumbnail_url, meta, created_at, updated_at
	          FROM assets WHERE id = ? AND deleted_at IS NULL`

	var a models.Asset
	var coverURL sql.NullString
	var thumbnailURL sql.NullString
	var meta sql.NullString
	err := database.DB.QueryRow(query, id).Scan(&a.ID, &a.ProjectID, &a.CharacterID, &a.Name, &a.Type, &a.FileURL, &coverURL, &thumbnailURL, &meta, &a.CreatedAt, &a.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	a.CoverURL = nullStringValue(coverURL)
	a.ThumbnailURL = nullStringValue(thumbnailURL)
	a.Meta = decodeAssetMeta(meta)
	return &a, nil
}

// Create creates a new asset
func (r *AssetRepository) Create(a *models.Asset) error {
	query := `INSERT INTO assets (project_id, character_id, name, type, file_url, cover_url, thumbnail_url, meta)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`

	result, err := database.DB.Exec(query, a.ProjectID, a.CharacterID, a.Name, a.Type, a.FileURL, normalizeNullableString(a.CoverURL), normalizeNullableString(a.ThumbnailURL), normalizeAssetMetaForDB(a.Meta))
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

func (r *AssetRepository) Update(a *models.Asset) error {
	query := `UPDATE assets SET character_id = ?, name = ?, type = ?, file_url = ?, cover_url = ?, thumbnail_url = ?, meta = ? WHERE id = ?`
	_, err := database.DB.Exec(query, a.CharacterID, a.Name, a.Type, a.FileURL, normalizeNullableString(a.CoverURL), normalizeNullableString(a.ThumbnailURL), normalizeAssetMetaForDB(a.Meta), a.ID)
	return err
}

func (r *AssetRepository) UpdateThumbnailURL(id int64, thumbnailURL string) error {
	query := `UPDATE assets SET thumbnail_url = ? WHERE id = ?`
	_, err := database.DB.Exec(query, normalizeNullableString(thumbnailURL), id)
	return err
}

func (r *AssetRepository) UpdateCoverURLs(id int64, coverURL, thumbnailURL string) error {
	query := `UPDATE assets SET cover_url = ?, thumbnail_url = ? WHERE id = ?`
	_, err := database.DB.Exec(query, normalizeNullableString(coverURL), normalizeNullableString(thumbnailURL), id)
	return err
}

// Delete soft deletes an asset
func (r *AssetRepository) Delete(id int64) error {
	query := `UPDATE assets SET deleted_at = NOW() WHERE id = ?`
	_, err := database.DB.Exec(query, id)
	return err
}

func normalizeAssetMetaForDB(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	if json.Valid([]byte(trimmed)) {
		return trimmed
	}
	encoded, err := json.Marshal(trimmed)
	if err != nil {
		return trimmed
	}
	return string(encoded)
}

func decodeAssetMeta(value sql.NullString) string {
	if !value.Valid {
		return ""
	}
	trimmed := strings.TrimSpace(value.String)
	if trimmed == "" {
		return ""
	}
	var text string
	if err := json.Unmarshal([]byte(trimmed), &text); err == nil {
		return text
	}
	return trimmed
}
