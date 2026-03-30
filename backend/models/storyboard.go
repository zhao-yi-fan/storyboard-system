package models

import (
	"time"
)

// Storyboard represents a single shot/storyboard in a scene
type Storyboard struct {
	ID              int64       `json:"id"`
	SceneID         int64       `json:"scene_id"`
	ChapterID       int64       `json:"chapter_id"`
	ProjectID       int64       `json:"project_id"`
	ShotNumber      int         `json:"shot_number"`
	Content         string      `json:"content"`
	CameraDirection string      `json:"camera_direction"`
	Duration        float64     `json:"duration"`
	Background      string      `json:"background"`
	ThumbnailURL    string      `json:"thumbnail_url"`
	Notes           string      `json:"notes"`
	SortOrder       int         `json:"sort_order"`
	CreatedAt       time.Time   `json:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at"`
	Characters      []Character `json:"characters,omitempty"`
}
