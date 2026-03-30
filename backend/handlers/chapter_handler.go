package handlers

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"storyboard-backend/models"
	"storyboard-backend/repository"
	"storyboard-backend/pkg/response"
)

// ChapterHandler handles chapter-related requests
type ChapterHandler struct {
	repo *repository.ChapterRepository
	projectRepo *repository.ProjectRepository
}

func NewChapterHandler() *ChapterHandler {
	return &ChapterHandler{
		repo: &repository.ChapterRepository{},
		projectRepo: &repository.ProjectRepository{},
	}
}

// GetByProject returns all chapters for a project
func (h *ChapterHandler) GetByProject(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseInt(projectIDStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid project id")
		return
	}

	// Check if project exists
	project, err := h.projectRepo.FindByID(projectID)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if project == nil {
		response.Error(c, "project not found")
		return
	}

	chapters, err := h.repo.FindByProjectID(projectID)
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	response.Success(c, chapters)
}

// GetByID returns a chapter by ID
func (h *ChapterHandler) GetByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}

	chapter, err := h.repo.FindByID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if chapter == nil {
		response.Error(c, "chapter not found")
		return
	}

	response.Success(c, chapter)
}

// Create creates a new chapter
func (h *ChapterHandler) Create(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseInt(projectIDStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid project id")
		return
	}

	// Check if project exists
	project, err := h.projectRepo.FindByID(projectID)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if project == nil {
		response.Error(c, "project not found")
		return
	}

	var req struct {
		Title   string `json:"title" binding:"required"`
		Summary string `json:"summary"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, err.Error())
		return
	}

	// Get max sort order
	maxSort, err := h.repo.GetMaxSortOrder(projectID)
	if err != nil {
		maxSort = 0
	}

	chapter := &models.Chapter{
		ProjectID: projectID,
		Title:     req.Title,
		Summary:   req.Summary,
		SortOrder: maxSort + 1,
	}

	if err := h.repo.Create(chapter); err != nil {
		response.Error(c, err.Error())
		return
	}

	response.Created(c, chapter)
}

// Update updates a chapter
func (h *ChapterHandler) Update(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}

	chapter, err := h.repo.FindByID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if chapter == nil {
		response.Error(c, "chapter not found")
		return
	}

	var req struct {
		Title   string `json:"title"`
		Summary string `json:"summary"`
		SortOrder int `json:"sort_order"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, err.Error())
		return
	}

	if req.Title != "" {
		chapter.Title = req.Title
	}
	chapter.Summary = req.Summary
	if req.SortOrder != 0 {
		chapter.SortOrder = req.SortOrder
	}

	if err := h.repo.Update(chapter); err != nil {
		response.Error(c, err.Error())
		return
	}

	response.Success(c, chapter)
}

// Delete deletes a chapter
func (h *ChapterHandler) Delete(c *gin.Context) {
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
