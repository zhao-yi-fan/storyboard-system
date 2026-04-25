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
	query := `SELECT id, project_id, name, description, avatar_url, avatar_preview_url, design_sheet_url, design_sheet_preview_url, voice_reference_url, voice_reference_duration, voice_reference_text, voice_name, voice_prompt, created_at, updated_at
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
		var designSheetURL sql.NullString
		var designSheetPreviewURL sql.NullString
		var voiceReferenceURL sql.NullString
		var voiceReferenceDuration sql.NullFloat64
		var voiceReferenceText sql.NullString
		var voiceName sql.NullString
		var voicePrompt sql.NullString
		if err := rows.Scan(&c.ID, &c.ProjectID, &c.Name, &c.Description, &avatarURL, &avatarPreviewURL, &designSheetURL, &designSheetPreviewURL, &voiceReferenceURL, &voiceReferenceDuration, &voiceReferenceText, &voiceName, &voicePrompt, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		c.AvatarURL = nullStringValue(avatarURL)
		c.AvatarPreviewURL = nullStringValue(avatarPreviewURL)
		c.DesignSheetURL = nullStringValue(designSheetURL)
		c.DesignSheetPreviewURL = nullStringValue(designSheetPreviewURL)
		c.VoiceReferenceURL = nullStringValue(voiceReferenceURL)
		c.VoiceReferenceDuration = nullFloat64Value(voiceReferenceDuration)
		c.VoiceReferenceText = nullStringValue(voiceReferenceText)
		c.VoiceName = nullStringValue(voiceName)
		c.VoicePrompt = nullStringValue(voicePrompt)
		characters = append(characters, c)
	}

	return characters, nil
}

// FindByID finds a character by ID
func (r *CharacterRepository) FindByID(id int64) (*models.Character, error) {
	query := `SELECT id, project_id, name, description, avatar_url, avatar_preview_url, design_sheet_url, design_sheet_preview_url, voice_reference_url, voice_reference_duration, voice_reference_text, voice_name, voice_prompt, created_at, updated_at
	          FROM characters WHERE id = ? AND deleted_at IS NULL`

	var c models.Character
	var avatarURL sql.NullString
	var avatarPreviewURL sql.NullString
	var designSheetURL sql.NullString
	var designSheetPreviewURL sql.NullString
	var voiceReferenceURL sql.NullString
	var voiceReferenceDuration sql.NullFloat64
	var voiceReferenceText sql.NullString
	var voiceName sql.NullString
	var voicePrompt sql.NullString
	err := database.DB.QueryRow(query, id).Scan(&c.ID, &c.ProjectID, &c.Name, &c.Description, &avatarURL, &avatarPreviewURL, &designSheetURL, &designSheetPreviewURL, &voiceReferenceURL, &voiceReferenceDuration, &voiceReferenceText, &voiceName, &voicePrompt, &c.CreatedAt, &c.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	c.AvatarURL = nullStringValue(avatarURL)
	c.AvatarPreviewURL = nullStringValue(avatarPreviewURL)
	c.DesignSheetURL = nullStringValue(designSheetURL)
	c.DesignSheetPreviewURL = nullStringValue(designSheetPreviewURL)
	c.VoiceReferenceURL = nullStringValue(voiceReferenceURL)
	c.VoiceReferenceDuration = nullFloat64Value(voiceReferenceDuration)
	c.VoiceReferenceText = nullStringValue(voiceReferenceText)
	c.VoiceName = nullStringValue(voiceName)
	c.VoicePrompt = nullStringValue(voicePrompt)
	return &c, nil
}

// Create creates a new character
func (r *CharacterRepository) Create(c *models.Character) error {
	query := `INSERT INTO characters (project_id, name, description, avatar_url, avatar_preview_url, design_sheet_url, design_sheet_preview_url, voice_reference_url, voice_reference_duration, voice_reference_text, voice_name, voice_prompt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	result, err := database.DB.Exec(query, c.ProjectID, c.Name, c.Description, c.AvatarURL, c.AvatarPreviewURL, c.DesignSheetURL, c.DesignSheetPreviewURL, c.VoiceReferenceURL, nullableFloat64(c.VoiceReferenceDuration), c.VoiceReferenceText, c.VoiceName, c.VoicePrompt)
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
	query := `UPDATE characters SET name = ?, description = ?, avatar_url = ?, avatar_preview_url = ?, design_sheet_url = ?, design_sheet_preview_url = ?, voice_reference_url = ?, voice_reference_duration = ?, voice_reference_text = ?, voice_name = ?, voice_prompt = ? WHERE id = ?`

	_, err := database.DB.Exec(query, c.Name, c.Description, c.AvatarURL, c.AvatarPreviewURL, c.DesignSheetURL, c.DesignSheetPreviewURL, c.VoiceReferenceURL, nullableFloat64(c.VoiceReferenceDuration), c.VoiceReferenceText, c.VoiceName, c.VoicePrompt, c.ID)
	return err
}

// Delete soft deletes a character
func (r *CharacterRepository) Delete(id int64) error {
	query := `UPDATE characters SET deleted_at = NOW() WHERE id = ?`
	_, err := database.DB.Exec(query, id)
	return err
}
