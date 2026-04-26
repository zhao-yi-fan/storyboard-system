package handlers

import (
	"encoding/json"
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
		h.ensureStoryboardVideoConsistency(&storyboards[i])
		h.ensureStoryboardPreview(c, &storyboards[i])
	}
	normalizeStoryboardsForResponse(storyboards)

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

	h.ensureStoryboardVideoConsistency(storyboard)
	h.ensureStoryboardPreview(c, storyboard)
	normalizeStoryboardForResponse(storyboard)
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

	items, err := h.ensureStoryboardVideoConsistency(storyboard)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if items == nil {
		items = []models.StoryboardMediaGeneration{}
	}
	normalizeMediaGenerationsForResponse(items)
	response.Success(c, items)
}

func (h *StoryboardHandler) SetMediaGenerationCurrent(c *gin.Context) {
	storyboardID, generationID, storyboard, generation, ok := h.loadMediaGenerationContext(c)
	if !ok {
		return
	}

	if generation.MediaType != "cover" && generation.MediaType != "video" {
		response.Error(c, "unsupported media type")
		return
	}
	if generation.Status != "succeeded" {
		response.Error(c, "only succeeded history can be set as current")
		return
	}

	if err := h.mediaRepo.MarkCurrent(storyboardID, generation.MediaType, generationID); err != nil {
		response.Error(c, err.Error())
		return
	}

	applyGenerationToStoryboard(storyboard, generation)
	if err := h.repo.Update(storyboard); err != nil {
		response.Error(c, err.Error())
		return
	}

	h.respondWithStoryboardAndHistory(c, storyboard)
}

func (h *StoryboardHandler) DeleteMediaGeneration(c *gin.Context) {
	storyboardID, generationID, storyboard, generation, ok := h.loadMediaGenerationContext(c)
	if !ok {
		return
	}

	if generation.Status == "generating" {
		response.Error(c, "generating history cannot be deleted")
		return
	}

	if err := h.mediaRepo.SoftDelete(generationID); err != nil {
		response.Error(c, err.Error())
		return
	}

	if generation.IsCurrent {
		fallback, err := h.mediaRepo.FindLatestSucceeded(storyboardID, generation.MediaType, generationID)
		if err != nil {
			response.Error(c, err.Error())
			return
		}

		if fallback != nil {
			if err := h.mediaRepo.MarkCurrent(storyboardID, generation.MediaType, fallback.ID); err != nil {
				response.Error(c, err.Error())
				return
			}
			applyGenerationToStoryboard(storyboard, fallback)
		} else {
			clearStoryboardMedia(storyboard, generation.MediaType)
		}

		if err := h.repo.Update(storyboard); err != nil {
			response.Error(c, err.Error())
			return
		}
	}

	h.respondWithStoryboardAndHistory(c, storyboard)
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
		Dialogue            string  `json:"dialogue"`
		ShotType            string  `json:"shot_type"`
		Mood                string  `json:"mood"`
		CameraDirection     string  `json:"camera_direction"`
		CameraMotion        string  `json:"camera_motion"`
		StylePreset         string  `json:"style_preset"`
		StyleNotes          string  `json:"style_notes"`
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
		Dialogue:            req.Dialogue,
		ShotType:            req.ShotType,
		Mood:                req.Mood,
		CameraDirection:     req.CameraDirection,
		CameraMotion:        req.CameraMotion,
		StylePreset:         req.StylePreset,
		StyleNotes:          req.StyleNotes,
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

	normalizeStoryboardForResponse(storyboard)
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
		Dialogue            *string  `json:"dialogue"`
		ShotType            *string  `json:"shot_type"`
		Mood                *string  `json:"mood"`
		CameraDirection     *string  `json:"camera_direction"`
		CameraMotion        *string  `json:"camera_motion"`
		StylePreset         *string  `json:"style_preset"`
		StyleNotes          *string  `json:"style_notes"`
		Duration            *float64 `json:"duration"`
		Background          *string  `json:"background"`
		ThumbnailURL        *string  `json:"thumbnail_url"`
		ThumbnailPreviewURL *string  `json:"thumbnail_preview_url"`
		VideoURL            *string  `json:"video_url"`
		VideoPreviewURL     *string  `json:"video_preview_url"`
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
	if req.Dialogue != nil {
		storyboard.Dialogue = *req.Dialogue
	}
	if req.ShotType != nil {
		storyboard.ShotType = *req.ShotType
	}
	if req.Mood != nil {
		storyboard.Mood = *req.Mood
	}
	if req.CameraDirection != nil {
		storyboard.CameraDirection = *req.CameraDirection
	}
	if req.CameraMotion != nil {
		storyboard.CameraMotion = *req.CameraMotion
	}
	if req.StylePreset != nil {
		storyboard.StylePreset = *req.StylePreset
	}
	if req.StyleNotes != nil {
		storyboard.StyleNotes = *req.StyleNotes
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
	if req.VideoPreviewURL != nil {
		storyboard.VideoPreviewURL = *req.VideoPreviewURL
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

	normalizeStoryboardForResponse(storyboard)
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
func (h *StoryboardHandler) PreviewCoverGeneration(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}
	selectedModel := strings.TrimSpace(c.Query("model"))
	if !config.IsSupportedCoverModel(selectedModel) {
		response.Error(c, "unsupported cover model")
		return
	}

	service, err := services.NewStoryboardCoverService()
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	preview, err := service.PreviewGeneration(id, requestPublicBaseURL(c), selectedModel)
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	for i := range preview.ReferenceImages {
		preview.ReferenceImages[i].URL = services.NewOSSService().ResolveURL(preview.ReferenceImages[i].URL, requestPublicBaseURL(c))
	}
	response.Success(c, preview)
}

func (h *StoryboardHandler) GenerateCover(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}

	var req struct {
		Model       string `json:"model"`
		UseTextOnly bool   `json:"use_text_only"`
	}
	if err := c.ShouldBindJSON(&req); err != nil && !strings.Contains(strings.ToLower(err.Error()), "eof") {
		response.Error(c, err.Error())
		return
	}
	if !config.IsSupportedCoverModel(strings.TrimSpace(req.Model)) {
		response.Error(c, "unsupported cover model")
		return
	}

	service, err := services.NewStoryboardCoverService()
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	storyboard, err := service.GenerateAndAttach(id, requestPublicBaseURL(c), strings.TrimSpace(req.Model), req.UseTextOnly)
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	normalizeStoryboardForResponse(storyboard)
	response.Success(c, gin.H{
		"storyboard_id":         storyboard.ID,
		"thumbnail_url":         storyboard.ThumbnailURL,
		"thumbnail_preview_url": storyboard.ThumbnailPreviewURL,
		"storyboard":            storyboard,
	})
}

// GenerateVideo generates and attaches a short video for a storyboard
func (h *StoryboardHandler) PreviewVideoGeneration(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}

	selectedModel := strings.TrimSpace(c.Query("model"))
	if selectedModel == "" {
		selectedModel = config.GlobalConfig.WanxVideoModel
	}
	if !config.IsSupportedVideoModel(selectedModel) {
		response.Error(c, "unsupported video model")
		return
	}

	selectedDuration := 5
	if durationStr := strings.TrimSpace(c.Query("duration")); durationStr != "" {
		durationValue, err := strconv.Atoi(durationStr)
		if err != nil {
			response.Error(c, "invalid duration")
			return
		}
		selectedDuration = durationValue
	}
	if config.IsSeedanceVideoModel(selectedModel) {
		if selectedDuration == 0 {
			selectedDuration = 5
		}
		if selectedDuration != 5 {
			response.Error(c, "当前 Seedance 视频当前按兼容配置生成，仅支持 5 秒输出")
			return
		}
	} else if selectedDuration != 5 {
		response.Error(c, "当前视频模型仅支持 5 秒输出")
		return
	}

	service, err := services.NewStoryboardVideoService()
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	preview, err := service.PreviewGeneration(id, requestPublicBaseURL(c), selectedModel, selectedDuration)
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	response.Success(c, preview)
}

func (h *StoryboardHandler) GenerateVideo(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}

	var req struct {
		Model    string `json:"model"`
		Duration *int   `json:"duration"`
	}
	if err := c.ShouldBindJSON(&req); err != nil && !strings.Contains(err.Error(), "EOF") {
		response.Error(c, err.Error())
		return
	}

	selectedModel := strings.TrimSpace(req.Model)
	if selectedModel == "" {
		selectedModel = config.GlobalConfig.WanxVideoModel
	}
	if !config.IsSupportedVideoModel(selectedModel) {
		response.Error(c, "unsupported video model")
		return
	}

	selectedDuration := 5
	if req.Duration != nil {
		selectedDuration = *req.Duration
	}
	if config.IsSeedanceVideoModel(selectedModel) {
		if selectedDuration == 0 {
			selectedDuration = 5
		}
		if selectedDuration != 5 {
			response.Error(c, "当前 Seedance 视频当前按兼容配置生成，仅支持 5 秒输出")
			return
		}
	} else if selectedDuration != 5 {
		response.Error(c, "当前视频模型仅支持 5 秒输出")
		return
	}

	service, err := services.NewStoryboardVideoService()
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	publicBaseURL := requestPublicBaseURL(c)

	storyboard, err := service.StartGenerate(id, publicBaseURL, selectedModel, selectedDuration)
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	normalizeStoryboardForResponse(storyboard)
	response.Success(c, gin.H{
		"storyboard_id":     storyboard.ID,
		"video_url":         storyboard.VideoURL,
		"video_preview_url": storyboard.VideoPreviewURL,
		"storyboard":        storyboard,
	})
}

func requestPublicBaseURL(c *gin.Context) string {
	if strings.TrimSpace(config.GlobalConfig.PublicAppBaseURL) != "" {
		return strings.TrimRight(config.GlobalConfig.PublicAppBaseURL, "/")
	}
	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	} else if forwardedProto := c.Request.Header.Get("X-Forwarded-Proto"); forwardedProto != "" {
		scheme = forwardedProto
	}
	return scheme + "://" + c.Request.Host
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

func (h *StoryboardHandler) loadMediaGenerationContext(c *gin.Context) (int64, int64, *models.Storyboard, *models.StoryboardMediaGeneration, bool) {
	storyboardID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.Error(c, "invalid storyboard id")
		return 0, 0, nil, nil, false
	}
	generationID, err := strconv.ParseInt(c.Param("generationId"), 10, 64)
	if err != nil {
		response.Error(c, "invalid generation id")
		return 0, 0, nil, nil, false
	}

	storyboard, err := h.repo.FindByID(storyboardID)
	if err != nil {
		response.Error(c, err.Error())
		return 0, 0, nil, nil, false
	}
	if storyboard == nil {
		response.Error(c, "storyboard not found")
		return 0, 0, nil, nil, false
	}

	generation, err := h.mediaRepo.FindByID(generationID)
	if err != nil {
		response.Error(c, err.Error())
		return 0, 0, nil, nil, false
	}
	if generation == nil || generation.StoryboardID != storyboardID {
		response.Error(c, "media generation not found")
		return 0, 0, nil, nil, false
	}

	return storyboardID, generationID, storyboard, generation, true
}

func (h *StoryboardHandler) ensureStoryboardVideoConsistency(storyboard *models.Storyboard) ([]models.StoryboardMediaGeneration, error) {
	if storyboard == nil {
		return []models.StoryboardMediaGeneration{}, nil
	}

	items, err := h.mediaRepo.ListByStoryboardID(storyboard.ID)
	if err != nil {
		return nil, err
	}

	videoItems := make([]models.StoryboardMediaGeneration, 0)
	var currentSucceeded *models.StoryboardMediaGeneration
	var latestSucceeded *models.StoryboardMediaGeneration
	for i := range items {
		item := items[i]
		if item.MediaType != "video" {
			continue
		}
		videoItems = append(videoItems, item)
		if item.Status == "succeeded" {
			if currentSucceeded == nil && item.IsCurrent {
				tmp := item
				currentSucceeded = &tmp
			}
			if latestSucceeded == nil {
				tmp := item
				latestSucceeded = &tmp
			}
		}
	}

	if strings.TrimSpace(storyboard.VideoURL) != "" && storyboard.VideoStatus == "succeeded" && latestSucceeded == nil {
		backfill := &models.StoryboardMediaGeneration{
			StoryboardID: storyboard.ID,
			MediaType:    "video",
			Model:        "legacy",
			Status:       "succeeded",
			ResultURL:    storyboard.VideoURL,
			PreviewURL:   storyboard.VideoPreviewURL,
			SourceURL:    storyboard.ThumbnailURL,
			ErrorMessage: "",
			IsCurrent:    true,
			MetaJSON: mustMarshalStoryboardMediaMeta(map[string]any{
				"duration":   storyboard.VideoDuration,
				"resolution": legacyVideoResolution(storyboard.VideoDuration),
				"audio":      legacyVideoAudio(storyboard.VideoDuration),
			}),
		}
		if err := h.mediaRepo.Create(backfill); err != nil {
			return nil, err
		}
		if err := h.mediaRepo.MarkCurrent(storyboard.ID, "video", backfill.ID); err != nil {
			return nil, err
		}
		items, err = h.mediaRepo.ListByStoryboardID(storyboard.ID)
		if err != nil {
			return nil, err
		}
		return items, nil
	}

	if storyboard.VideoStatus == "generating" {
		return items, nil
	}

	if latestSucceeded == nil && storyboard.VideoStatus != "succeeded" && (strings.TrimSpace(storyboard.VideoURL) != "" || strings.TrimSpace(storyboard.VideoPreviewURL) != "") {
		storyboard.VideoURL = ""
		storyboard.VideoPreviewURL = ""
		storyboard.VideoDuration = 0
		if err := h.repo.Update(storyboard); err != nil {
			return nil, err
		}
	}

	repairSource := currentSucceeded
	if repairSource == nil {
		repairSource = latestSucceeded
	}
	if repairSource != nil && (storyboard.VideoStatus == "failed" || (storyboard.VideoStatus == "" && strings.TrimSpace(storyboard.VideoURL) == "")) {
		applyGenerationToStoryboard(storyboard, repairSource)
		storyboard.VideoError = ""
		if err := h.repo.Update(storyboard); err != nil {
			return nil, err
		}
	}

	return items, nil
}

func (h *StoryboardHandler) respondWithStoryboardAndHistory(c *gin.Context, storyboard *models.Storyboard) {
	items, err := h.ensureStoryboardVideoConsistency(storyboard)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	h.ensureStoryboardPreview(c, storyboard)
	if items == nil {
		items = []models.StoryboardMediaGeneration{}
	}

	normalizeStoryboardForResponse(storyboard)
	normalizeMediaGenerationsForResponse(items)
	response.Success(c, gin.H{
		"storyboard":        storyboard,
		"media_generations": items,
	})
}

func legacyVideoResolution(duration float64) string {
	if duration <= 2 {
		return "480p"
	}
	return "720P"
}

func legacyVideoAudio(duration float64) bool {
	return true
}

func applyGenerationToStoryboard(storyboard *models.Storyboard, generation *models.StoryboardMediaGeneration) {
	if storyboard == nil || generation == nil {
		return
	}

	switch generation.MediaType {
	case "cover":
		storyboard.ThumbnailURL = generation.ResultURL
		storyboard.ThumbnailPreviewURL = generation.PreviewURL
	case "video":
		storyboard.VideoURL = generation.ResultURL
		storyboard.VideoPreviewURL = generation.PreviewURL
		storyboard.VideoStatus = generation.Status
		storyboard.VideoError = generation.ErrorMessage
		if duration := extractVideoDuration(generation.MetaJSON); duration > 0 {
			storyboard.VideoDuration = duration
			storyboard.Duration = duration
		}
	}
}

func clearStoryboardMedia(storyboard *models.Storyboard, mediaType string) {
	if storyboard == nil {
		return
	}

	switch mediaType {
	case "cover":
		storyboard.ThumbnailURL = ""
		storyboard.ThumbnailPreviewURL = ""
	case "video":
		storyboard.VideoURL = ""
		storyboard.VideoPreviewURL = ""
		storyboard.VideoStatus = ""
		storyboard.VideoError = ""
		storyboard.VideoDuration = 0
		storyboard.Duration = 0
	}
}

func extractVideoDuration(metaJSON string) float64 {
	if strings.TrimSpace(metaJSON) == "" {
		return 0
	}

	var meta map[string]any
	if err := json.Unmarshal([]byte(metaJSON), &meta); err != nil {
		return 0
	}

	if value, ok := meta["duration"]; ok {
		switch v := value.(type) {
		case float64:
			return v
		case int:
			return float64(v)
		}
	}
	switch value := meta["duration_seconds"].(type) {
	case float64:
		return value
	case int:
		return float64(value)
	}
	return 0
}

func mustMarshalStoryboardMediaMeta(meta map[string]any) string {
	if meta == nil {
		return ""
	}
	data, err := json.Marshal(meta)
	if err != nil {
		return ""
	}
	return string(data)
}
