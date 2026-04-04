package handlers

import (
	"fmt"
	"log"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"storyboard-backend/config"
	"storyboard-backend/models"
	"storyboard-backend/pkg/response"
	"storyboard-backend/repository"
	"storyboard-backend/services"
)

// StoryboardHandler handles storyboard-related requests
type StoryboardHandler struct {
	repo           *repository.StoryboardRepository
	sceneRepo      *repository.SceneRepository
	mediaRepo      *repository.StoryboardMediaGenerationRepository
	previewService *services.ImagePreviewService
}

func NewStoryboardHandler() *StoryboardHandler {
	return &StoryboardHandler{
		repo:           &repository.StoryboardRepository{},
		sceneRepo:      &repository.SceneRepository{},
		mediaRepo:      &repository.StoryboardMediaGenerationRepository{},
		previewService: services.NewImagePreviewService(),
	}
}

// GetByScene returns all storyboards for a scene
func (h *StoryboardHandler) GetByScene(c *gin.Context) {
	sceneIDStr := c.Param("id")
	sceneID, err := strconv.ParseInt(sceneIDStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid scene id")
		return
	}

	scene, err := h.sceneRepo.FindByID(sceneID)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if scene == nil {
		response.Error(c, "scene not found")
		return
	}

	storyboards, err := h.repo.FindBySceneID(sceneID)
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	for i := range storyboards {
		h.ensureStoryboardPreview(c, &storyboards[i])
	}

	response.Success(c, storyboards)
}

// GetByID returns a storyboard by ID
func (h *StoryboardHandler) GetByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}

	storyboard, err := h.repo.FindByID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if storyboard == nil {
		response.Error(c, "storyboard not found")
		return
	}

	h.ensureStoryboardPreview(c, storyboard)
	response.Success(c, storyboard)
}

func (h *StoryboardHandler) GetMediaGenerations(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}

	storyboard, err := h.repo.FindByID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if storyboard == nil {
		response.Error(c, "storyboard not found")
		return
	}

	items, err := h.mediaRepo.ListByStoryboardID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if items == nil {
		items = []models.StoryboardMediaGeneration{}
	}
	response.Success(c, items)
}

// Create creates a new storyboard
func (h *StoryboardHandler) Create(c *gin.Context) {
	sceneIDStr := c.Param("id")
	sceneID, err := strconv.ParseInt(sceneIDStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid scene id")
		return
	}

	scene, err := h.sceneRepo.FindByID(sceneID)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if scene == nil {
		response.Error(c, "scene not found")
		return
	}

	var req struct {
		ShotNumber          int     `json:"shot_number"`
		Content             string  `json:"content" binding:"required"`
		CameraDirection     string  `json:"camera_direction"`
		Duration            float64 `json:"duration"`
		Background          string  `json:"background"`
		ThumbnailURL        string  `json:"thumbnail_url"`
		ThumbnailPreviewURL string  `json:"thumbnail_preview_url"`
		Notes               string  `json:"notes"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, err.Error())
		return
	}

	maxSort, err := h.repo.GetMaxSortOrder(sceneID)
	if err != nil {
		maxSort = 0
	}

	shotNumber := req.ShotNumber
	if shotNumber == 0 {
		shotNumber = maxSort + 1
	}

	storyboard := &models.Storyboard{
		SceneID:             sceneID,
		ChapterID:           scene.ChapterID,
		ProjectID:           scene.ProjectID,
		ShotNumber:          shotNumber,
		Content:             req.Content,
		CameraDirection:     req.CameraDirection,
		Duration:            req.Duration,
		Background:          req.Background,
		ThumbnailURL:        req.ThumbnailURL,
		ThumbnailPreviewURL: req.ThumbnailPreviewURL,
		Notes:               req.Notes,
		SortOrder:           maxSort + 1,
	}

	if err := h.repo.Create(storyboard); err != nil {
		response.Error(c, err.Error())
		return
	}

	response.Created(c, storyboard)
}

// Update updates a storyboard
func (h *StoryboardHandler) Update(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}

	storyboard, err := h.repo.FindByID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if storyboard == nil {
		response.Error(c, "storyboard not found")
		return
	}

	var req struct {
		ShotNumber          *int     `json:"shot_number"`
		Content             *string  `json:"content"`
		CameraDirection     *string  `json:"camera_direction"`
		Duration            *float64 `json:"duration"`
		Background          *string  `json:"background"`
		ThumbnailURL        *string  `json:"thumbnail_url"`
		ThumbnailPreviewURL *string  `json:"thumbnail_preview_url"`
		VideoURL            *string  `json:"video_url"`
		VideoStatus         *string  `json:"video_status"`
		VideoError          *string  `json:"video_error"`
		VideoDuration       *float64 `json:"video_duration"`
		Notes               *string  `json:"notes"`
		SortOrder           *int     `json:"sort_order"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, err.Error())
		return
	}

	if req.ShotNumber != nil {
		storyboard.ShotNumber = *req.ShotNumber
	}
	if req.Content != nil {
		storyboard.Content = *req.Content
	}
	if req.CameraDirection != nil {
		storyboard.CameraDirection = *req.CameraDirection
	}
	if req.Duration != nil {
		storyboard.Duration = *req.Duration
	}
	if req.Background != nil {
		storyboard.Background = *req.Background
	}
	if req.ThumbnailURL != nil {
		storyboard.ThumbnailURL = *req.ThumbnailURL
	}
	if req.ThumbnailPreviewURL != nil {
		storyboard.ThumbnailPreviewURL = *req.ThumbnailPreviewURL
	}
	if req.VideoURL != nil {
		storyboard.VideoURL = *req.VideoURL
	}
	if req.VideoStatus != nil {
		storyboard.VideoStatus = *req.VideoStatus
	}
	if req.VideoError != nil {
		storyboard.VideoError = *req.VideoError
	}
	if req.VideoDuration != nil {
		storyboard.VideoDuration = *req.VideoDuration
	}
	if req.Notes != nil {
		storyboard.Notes = *req.Notes
	}
	if req.SortOrder != nil {
		storyboard.SortOrder = *req.SortOrder
	}

	if err := h.repo.Update(storyboard); err != nil {
		response.Error(c, err.Error())
		return
	}

	response.Success(c, storyboard)
}

// Delete deletes a storyboard
func (h *StoryboardHandler) Delete(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}

	if err := h.repo.Delete(id); err != nil {
		response.Error(c, err.Error())
		return
	}

	response.Success(c, gin.H{"success": true})
}

// GenerateCover generates and attaches a cover image for a storyboard
func (h *StoryboardHandler) GenerateCover(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}

	service, err := services.NewStoryboardCoverService()
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	storyboard, err := service.GenerateAndAttach(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"storyboard_id":         storyboard.ID,
		"thumbnail_url":         storyboard.ThumbnailURL,
		"thumbnail_preview_url": storyboard.ThumbnailPreviewURL,
		"storyboard":            storyboard,
	})
}

// GenerateVideo generates and attaches a short video for a storyboard
func (h *StoryboardHandler) GenerateVideo(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}

	service, err := services.NewStoryboardVideoService()
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	} else if forwardedProto := c.Request.Header.Get("X-Forwarded-Proto"); forwardedProto != "" {
		scheme = forwardedProto
	}
	publicBaseURL := scheme + "://" + c.Request.Host
	if strings.TrimSpace(config.GlobalConfig.PublicAppBaseURL) != "" {
		publicBaseURL = strings.TrimRight(config.GlobalConfig.PublicAppBaseURL, "/")
	}

	storyboard, err := service.StartGenerate(id, publicBaseURL)
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"storyboard_id": storyboard.ID,
		"video_url":     storyboard.VideoURL,
		"storyboard":    storyboard,
	})
}

func (h *StoryboardHandler) ensureStoryboardPreview(c *gin.Context, storyboard *models.Storyboard) {
	if storyboard == nil || strings.TrimSpace(storyboard.ThumbnailURL) == "" || strings.TrimSpace(storyboard.ThumbnailPreviewURL) != "" {
		return
	}

	previewURL, err := h.previewService.CreatePreviewFromSource(c.Request.Context(), storyboard.ThumbnailURL, "covers", fmt.Sprintf("storyboard-%d", storyboard.ID), services.StoryboardPreviewSpec())
	if err != nil {
		log.Printf("failed to generate storyboard preview for %d: %v", storyboard.ID, err)
		return
	}
	storyboard.ThumbnailPreviewURL = previewURL
	if err := h.repo.Update(storyboard); err != nil {
		log.Printf("failed to persist storyboard preview for %d: %v", storyboard.ID, err)
	}
}
