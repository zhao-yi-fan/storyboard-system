package models

import "time"

type StoryboardMediaGeneration struct {
	ID           int64     `json:"id"`
	StoryboardID int64     `json:"storyboard_id"`
	MediaType    string    `json:"media_type"`
	Model        string    `json:"model"`
	Status       string    `json:"status"`
	ResultURL    string    `json:"result_url"`
	PreviewURL   string    `json:"preview_url"`
	SourceURL    string    `json:"source_url"`
	ErrorMessage string    `json:"error_message"`
	IsCurrent    bool      `json:"is_current"`
	MetaJSON     string    `json:"meta_json"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
