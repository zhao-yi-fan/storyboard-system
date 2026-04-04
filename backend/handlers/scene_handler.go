package handlers

import (
	"strconv"

	"storyboard-backend/models"
	"storyboard-backend/pkg/response"
	"storyboard-backend/repository"

	"github.com/gin-gonic/gin"
)

// SceneHandler handles scene-related requests
type SceneHandler struct {
	repo *repository.SceneRepository
	chapterRepo *repository.ChapterRepository
}

func NewSceneHandler() *SceneHandler {
	return &SceneHandler{
		repo: &repository.SceneRepository{},
		chapterRepo: &repository.ChapterRepository{},
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

	// Check if chapter exists
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
	if scenes == nil {
		scenes = []models.Scene{}
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

	// Check if chapter exists
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
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, err.Error())
		return
	}

	// Get max sort order
	maxSort, err := h.repo.GetMaxSortOrder(chapterID)
	if err != nil {
		maxSort = 0
	}

	scene := &models.Scene{
		ChapterID:   chapterID,
		ProjectID:   chapter.ProjectID,
		Title:       req.Title,
		Description: req.Description,
		Location:    req.Location,
		TimeOfDay:   req.TimeOfDay,
		SortOrder:   maxSort + 1,
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
