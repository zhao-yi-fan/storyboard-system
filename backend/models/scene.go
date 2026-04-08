package models

import "time"

// Scene represents a scene in a chapter
type Scene struct {
	ID              int64     `json:"id"`
	ChapterID       int64     `json:"chapter_id"`
	ProjectID       int64     `json:"project_id"`
	Title           string    `json:"title"`
	Description     string    `json:"description"`
	Location        string    `json:"location"`
	TimeOfDay       string    `json:"time_of_day"`
	CoverURL        string    `json:"cover_url"`
	CoverPreviewURL string    `json:"cover_preview_url"`
	VideoURL        string    `json:"video_url"`
	VideoPreviewURL string    `json:"video_preview_url"`
	VideoStatus     string    `json:"video_status"`
	VideoError      string    `json:"video_error"`
	VideoDuration   float64   `json:"video_duration"`
	SortOrder       int       `json:"sort_order"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}
