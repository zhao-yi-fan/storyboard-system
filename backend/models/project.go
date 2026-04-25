package models

import "time"

// Project represents a storyboard project
type Project struct {
	ID              int64      `json:"id"`
	Name            string     `json:"name"`
	Description     string     `json:"description"`
	ScriptText      string     `json:"script_text"`
	VideoURL        string     `json:"video_url"`
	VideoPreviewURL string     `json:"video_preview_url"`
	VideoStatus     string     `json:"video_status"`
	VideoError      string     `json:"video_error"`
	VideoDuration   float64    `json:"video_duration"`
	PinnedAt        *time.Time `json:"pinned_at,omitempty"`
	IsPinned        bool       `json:"is_pinned"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// ProjectWithStats includes project with statistics
type ProjectWithStats struct {
	Project
	ChapterCount    int `json:"chapter_count"`
	SceneCount      int `json:"scene_count"`
	StoryboardCount int `json:"storyboard_count"`
}
