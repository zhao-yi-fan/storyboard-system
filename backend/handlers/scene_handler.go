package handlers

import (
	"fmt"
	"log"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"storyboard-backend/models"
	"storyboard-backend/pkg/response"
	"storyboard-backend/repository"
	"storyboard-backend/services"
)

// SceneHandler handles scene-related requests
type SceneHandler struct {
	repo           *repository.SceneRepository
	chapterRepo    *repository.ChapterRepository
	storyboardRepo *repository.StoryboardRepository
	previewService *services.ImagePreviewService
}

func NewSceneHandler() *SceneHandler {
	return &SceneHandler{
		repo:           &repository.SceneRepository{},
		chapterRepo:    &repository.ChapterRepository{},
		storyboardRepo: &repository.StoryboardRepository{},
		previewService: services.NewImagePreviewService(),
	}
}

// GetByChapter returns all scenes for a chapter
func (h *SceneHandler) GetByChapter(c *gin.Context) {
	chapterIDStr := c.Param("id")
	chapterID, err := strconv.ParseInt(chapterIDStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid chapter id")
		return
	}

	chapter, err := h.chapterRepo.FindByID(chapterID)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if chapter == nil {
		response.Error(c, "chapter not found")
		return
	}

	scenes, err := h.repo.FindByChapterID(chapterID)
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	for i := range scenes {
		h.ensureScenePreview(c, &scenes[i])
	}

	response.Success(c, scenes)
}

// GetByID returns a scene by ID
func (h *SceneHandler) GetByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}

	scene, err := h.repo.FindByID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if scene == nil {
		response.Error(c, "scene not found")
		return
	}

	h.ensureScenePreview(c, scene)
	response.Success(c, scene)
}

// Create creates a new scene
func (h *SceneHandler) Create(c *gin.Context) {
	chapterIDStr := c.Param("id")
	chapterID, err := strconv.ParseInt(chapterIDStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid chapter id")
		return
	}

	chapter, err := h.chapterRepo.FindByID(chapterID)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if chapter == nil {
		response.Error(c, "chapter not found")
		return
	}

	var req struct {
		Title       string `json:"title" binding:"required"`
		Description string `json:"description"`
		Location    string `json:"location"`
		TimeOfDay   string `json:"time_of_day"`
		StylePreset string `json:"style_preset"`
		StyleNotes  string `json:"style_notes"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, err.Error())
		return
	}

	maxSort, err := h.repo.GetMaxSortOrder(chapterID)
	if err != nil {
		maxSort = 0
	}

	scene := &models.Scene{
		ChapterID:       chapterID,
		ProjectID:       chapter.ProjectID,
		Title:           req.Title,
		Description:     req.Description,
		Location:        req.Location,
		TimeOfDay:       req.TimeOfDay,
		CoverURL:        "",
		CoverPreviewURL: "",
		VideoURL:        "",
		VideoPreviewURL: "",
		VideoStatus:     "",
		VideoError:      "",
		VideoDuration:   0,
		StylePreset:     req.StylePreset,
		StyleNotes:      req.StyleNotes,
		SortOrder:       maxSort + 1,
	}

	if err := h.repo.Create(scene); err != nil {
		response.Error(c, err.Error())
		return
	}

	response.Created(c, scene)
}

// Update updates a scene
func (h *SceneHandler) Update(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}

	scene, err := h.repo.FindByID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if scene == nil {
		response.Error(c, "scene not found")
		return
	}

	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Location    string `json:"location"`
		TimeOfDay   string `json:"time_of_day"`
		StylePreset string `json:"style_preset"`
		StyleNotes  string `json:"style_notes"`
		SortOrder   int    `json:"sort_order"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, err.Error())
		return
	}

	if req.Title != "" {
		scene.Title = req.Title
	}
	scene.Description = req.Description
	scene.Location = req.Location
	scene.TimeOfDay = req.TimeOfDay
	scene.StylePreset = req.StylePreset
	scene.StyleNotes = req.StyleNotes
	if req.SortOrder != 0 {
		scene.SortOrder = req.SortOrder
	}

	if err := h.repo.Update(scene); err != nil {
		response.Error(c, err.Error())
		return
	}

	response.Success(c, scene)
}

// Delete deletes a scene
func (h *SceneHandler) Delete(c *gin.Context) {
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

// GenerateCover generates and attaches a cover image for a scene.
func (h *SceneHandler) GenerateCover(c *gin.Context) {
	id, scene, ok := h.loadSceneContext(c)
	if !ok {
		return
	}

	service, err := services.NewSceneCoverService()
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	scene, err = service.GenerateAndAttach(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	h.ensureScenePreview(c, scene)
	response.Success(c, gin.H{
		"scene_id":          scene.ID,
		"cover_url":         scene.CoverURL,
		"cover_preview_url": scene.CoverPreviewURL,
		"scene":             scene,
	})
}

// GenerateStoryboardCovers batch-generates storyboard covers for a scene.
func (h *SceneHandler) GenerateStoryboardCovers(c *gin.Context) {
	id, _, ok := h.loadSceneContext(c)
	if !ok {
		return
	}

	storyboards, err := h.storyboardRepo.FindBySceneID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	coverService, err := services.NewStoryboardCoverService()
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	type failedItem struct {
		StoryboardID int64  `json:"storyboard_id"`
		Error        string `json:"error"`
	}
	failed := make([]failedItem, 0)
	generatedCount := 0

	for _, storyboard := range storyboards {
		if _, err := coverService.GenerateAndAttach(storyboard.ID, requestPublicBaseURL(c), false); err != nil {
			failed = append(failed, failedItem{StoryboardID: storyboard.ID, Error: err.Error()})
			continue
		}
		generatedCount++
	}

	updatedScene, err := h.repo.FindByID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if updatedScene == nil {
		response.Error(c, "scene not found")
		return
	}
	updatedStoryboards, err := h.storyboardRepo.FindBySceneID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	for i := range updatedStoryboards {
		if strings.TrimSpace(updatedStoryboards[i].ThumbnailURL) != "" && strings.TrimSpace(updatedStoryboards[i].ThumbnailPreviewURL) == "" {
			log.Printf("storyboard %d missing preview after batch generation", updatedStoryboards[i].ID)
		}
	}

	h.ensureScenePreview(c, updatedScene)
	response.Success(c, gin.H{
		"scene":           updatedScene,
		"storyboards":     updatedStoryboards,
		"generated_count": generatedCount,
		"failed":          failed,
	})
}

// ComposeVideo composes a scene-level video from succeeded storyboard videos.
func (h *SceneHandler) ComposeVideo(c *gin.Context) {
	id, _, ok := h.loadSceneContext(c)
	if !ok {
		return
	}

	var req struct {
		Regenerate *bool `json:"regenerate"`
	}
	if err := c.ShouldBindJSON(&req); err != nil && !strings.Contains(strings.ToLower(err.Error()), "eof") {
		response.Error(c, err.Error())
		return
	}
	regenerate := true
	if req.Regenerate != nil {
		regenerate = *req.Regenerate
	}

	service, err := services.NewSceneVideoService()
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	scene, err := service.ComposeAndAttach(id, regenerate)
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"scene_id":          scene.ID,
		"video_url":         scene.VideoURL,
		"video_preview_url": scene.VideoPreviewURL,
		"video_status":      scene.VideoStatus,
		"video_error":       scene.VideoError,
		"video_duration":    scene.VideoDuration,
		"scene":             scene,
	})
}

func (h *SceneHandler) loadSceneContext(c *gin.Context) (int64, *models.Scene, bool) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return 0, nil, false
	}

	scene, err := h.repo.FindByID(id)
	if err != nil {
		response.Error(c, err.Error())
		return 0, nil, false
	}
	if scene == nil {
		response.Error(c, "scene not found")
		return 0, nil, false
	}
	return id, scene, true
}

func (h *SceneHandler) ensureScenePreview(c *gin.Context, scene *models.Scene) {
	if scene == nil || strings.TrimSpace(scene.CoverURL) == "" || strings.TrimSpace(scene.CoverPreviewURL) != "" {
		return
	}

	previewURL, err := h.previewService.CreatePreviewFromSource(c.Request.Context(), scene.CoverURL, "scene-covers", fmt.Sprintf("scene-%d", scene.ID), services.StoryboardPreviewSpec())
	if err != nil {
		log.Printf("failed to generate scene preview for %d: %v", scene.ID, err)
		return
	}
	scene.CoverPreviewURL = previewURL
	if err := h.repo.Update(scene); err != nil {
		log.Printf("failed to persist scene preview for %d: %v", scene.ID, err)
	}
}
