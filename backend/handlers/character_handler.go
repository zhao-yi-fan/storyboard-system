package handlers

import (
	"strconv"

	"storyboard-backend/models"
	"storyboard-backend/pkg/response"
	"storyboard-backend/repository"

	"github.com/gin-gonic/gin"
)

// CharacterHandler handles character-related requests
type CharacterHandler struct {
	repo *repository.CharacterRepository
	projectRepo *repository.ProjectRepository
}

func NewCharacterHandler() *CharacterHandler {
	return &CharacterHandler{
		repo: &repository.CharacterRepository{},
		projectRepo: &repository.ProjectRepository{},
	}
}

// GetByProject returns all characters for a project
func (h *CharacterHandler) GetByProject(c *gin.Context) {
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

	characters, err := h.repo.FindByProjectID(projectID)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if characters == nil {
		characters = []models.Character{}
	}

	response.Success(c, characters)
}

// GetByID returns a character by ID
func (h *CharacterHandler) GetByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}

	character, err := h.repo.FindByID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if character == nil {
		response.Error(c, "character not found")
		return
	}

	response.Success(c, character)
}

// Create creates a new character
func (h *CharacterHandler) Create(c *gin.Context) {
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
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
		AvatarURL   string `json:"avatar_url"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, err.Error())
		return
	}

	character := &models.Character{
		ProjectID:   projectID,
		Name:        req.Name,
		Description: req.Description,
		AvatarURL:   req.AvatarURL,
	}

	if err := h.repo.Create(character); err != nil {
		response.Error(c, err.Error())
		return
	}

	response.Created(c, character)
}

// Update updates a character
func (h *CharacterHandler) Update(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}

	character, err := h.repo.FindByID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if character == nil {
		response.Error(c, "character not found")
		return
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		AvatarURL   string `json:"avatar_url"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, err.Error())
		return
	}

	if req.Name != "" {
		character.Name = req.Name
	}
	character.Description = req.Description
	character.AvatarURL = req.AvatarURL

	if err := h.repo.Update(character); err != nil {
		response.Error(c, err.Error())
		return
	}

	response.Success(c, character)
}

// Delete deletes a character
func (h *CharacterHandler) Delete(c *gin.Context) {
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
