package models

import "time"

// Asset represents a media asset (character image, background, etc.)
type Asset struct {
	ID          int64      `json:"id"`
	ProjectID   int64      `json:"project_id"`
	CharacterID *int64     `json:"character_id,omitempty"`
	Name        string     `json:"name"`
	Type        string     `json:"type"` // character/image/scene/background
	FileURL     string     `json:"file_url"`
	ThumbnailURL string    `json:"thumbnail_url"`
	Meta        string     `json:"meta,omitempty"` // JSON metadata
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}
