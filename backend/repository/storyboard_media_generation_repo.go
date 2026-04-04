package repository

import (
	"database/sql"

	"storyboard-backend/database"
	"storyboard-backend/models"
)

type StoryboardMediaGenerationRepository struct{}

func (r *StoryboardMediaGenerationRepository) ListByStoryboardID(storyboardID int64) ([]models.StoryboardMediaGeneration, error) {
	rows, err := database.DB.Query(`SELECT id, storyboard_id, media_type, model, status, result_url, preview_url, source_url, error_message, is_current, meta_json, created_at, updated_at
		FROM storyboard_media_generations
		WHERE storyboard_id = ?
		ORDER BY created_at DESC, id DESC`, storyboardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.StoryboardMediaGeneration, 0)
	for rows.Next() {
		item, err := scanStoryboardMediaGeneration(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *StoryboardMediaGenerationRepository) Create(item *models.StoryboardMediaGeneration) error {
	result, err := database.DB.Exec(`INSERT INTO storyboard_media_generations
		(storyboard_id, media_type, model, status, result_url, preview_url, source_url, error_message, is_current, meta_json)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		item.StoryboardID,
		item.MediaType,
		item.Model,
		item.Status,
		normalizeNullableString(item.ResultURL),
		normalizeNullableString(item.PreviewURL),
		normalizeNullableString(item.SourceURL),
		normalizeNullableString(item.ErrorMessage),
		item.IsCurrent,
		normalizeNullableString(item.MetaJSON),
	)
	if err != nil {
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	item.ID = id
	return nil
}

func (r *StoryboardMediaGenerationRepository) Update(item *models.StoryboardMediaGeneration) error {
	_, err := database.DB.Exec(`UPDATE storyboard_media_generations
		SET model = ?, status = ?, result_url = ?, preview_url = ?, source_url = ?, error_message = ?, is_current = ?, meta_json = ?
		WHERE id = ?`,
		item.Model,
		item.Status,
		normalizeNullableString(item.ResultURL),
		normalizeNullableString(item.PreviewURL),
		normalizeNullableString(item.SourceURL),
		normalizeNullableString(item.ErrorMessage),
		item.IsCurrent,
		normalizeNullableString(item.MetaJSON),
		item.ID,
	)
	return err
}

func (r *StoryboardMediaGenerationRepository) MarkCurrent(storyboardID int64, mediaType string, generationID int64) error {
	tx, err := database.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`UPDATE storyboard_media_generations SET is_current = 0 WHERE storyboard_id = ? AND media_type = ?`, storyboardID, mediaType); err != nil {
		return err
	}
	if _, err := tx.Exec(`UPDATE storyboard_media_generations SET is_current = 1 WHERE id = ?`, generationID); err != nil {
		return err
	}
	return tx.Commit()
}

func scanStoryboardMediaGeneration(scanner interface{ Scan(dest ...any) error }) (models.StoryboardMediaGeneration, error) {
	var item models.StoryboardMediaGeneration
	var resultURL sql.NullString
	var previewURL sql.NullString
	var sourceURL sql.NullString
	var errorMessage sql.NullString
	var metaJSON sql.NullString
	var isCurrent bool

	err := scanner.Scan(
		&item.ID,
		&item.StoryboardID,
		&item.MediaType,
		&item.Model,
		&item.Status,
		&resultURL,
		&previewURL,
		&sourceURL,
		&errorMessage,
		&isCurrent,
		&metaJSON,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		return models.StoryboardMediaGeneration{}, err
	}

	item.ResultURL = nullStringValue(resultURL)
	item.PreviewURL = nullStringValue(previewURL)
	item.SourceURL = nullStringValue(sourceURL)
	item.ErrorMessage = nullStringValue(errorMessage)
	item.MetaJSON = nullStringValue(metaJSON)
	item.IsCurrent = isCurrent
	return item, nil
}

func normalizeNullableString(value string) any {
	if value == "" {
		return nil
	}
	return value
}
