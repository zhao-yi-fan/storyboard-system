package handlers

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"storyboard-backend/repository"
	"storyboard-backend/pkg/response"
)

// AssetHandler handles asset-related requests
type AssetHandler struct {
	repo *repository.AssetRepository
	projectRepo *repository.ProjectRepository
	characterRepo *repository.CharacterRepository
}

func NewAssetHandler() *AssetHandler {
	return &AssetHandler{
		repo: &repository.AssetRepository{},
		projectRepo: &repository.ProjectRepository{},
		characterRepo: &repository.CharacterRepository{},
	}
}

// GetByProject returns all assets for a project
func (h *AssetHandler) GetByProject(c *gin.Context) {
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

	assets, err := h.repo.FindByProjectID(projectID)
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	response.Success(c, assets)
}

// GetByCharacter returns all assets for a character
func (h *AssetHandler) GetByCharacter(c *gin.Context) {
	characterIDStr := c.Param("id")
	characterID, err := strconv.ParseInt(characterIDStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid character id")
		return
	}

	// Check if character exists
	character, err := h.characterRepo.FindByID(characterID)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if character == nil {
		response.Error(c, "character not found")
		return
	}

	assets, err := h.repo.FindByCharacterID(characterID)
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	response.Success(c, assets)
}

// Delete deletes an asset
func (h *AssetHandler) Delete(c *gin.Context) {
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
