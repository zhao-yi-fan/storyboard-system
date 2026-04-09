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

// AssetHandler handles asset-related requests
type AssetHandler struct {
	repo                  *repository.AssetRepository
	usageRepo             *repository.StoryboardAssetUsageRepository
	projectRepo           *repository.ProjectRepository
	characterRepo         *repository.CharacterRepository
	previewService        *services.ImagePreviewService
	generatedImageService *services.GeneratedImageService
}

func NewAssetHandler() *AssetHandler {
	return &AssetHandler{
		repo:                  &repository.AssetRepository{},
		usageRepo:             &repository.StoryboardAssetUsageRepository{},
		projectRepo:           &repository.ProjectRepository{},
		characterRepo:         &repository.CharacterRepository{},
		previewService:        services.NewImagePreviewService(),
		generatedImageService: services.NewGeneratedImageService(),
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
	if assets == nil {
		assets = []models.Asset{}
	}

	for i := range assets {
		h.ensureAssetPreview(c, &assets[i])
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
	if assets == nil {
		assets = []models.Asset{}
	}

	for i := range assets {
		h.ensureAssetPreview(c, &assets[i])
	}

	response.Success(c, assets)
}

// Create creates a new asset under a project
func (h *AssetHandler) Create(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseInt(projectIDStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid project id")
		return
	}

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
		CharacterID *int64 `json:"character_id"`
		Name        string `json:"name" binding:"required"`
		Type        string `json:"type" binding:"required"`
		FileURL     string `json:"file_url"`
		Meta        string `json:"meta"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, err.Error())
		return
	}

	if req.CharacterID != nil {
		character, err := h.characterRepo.FindByID(*req.CharacterID)
		if err != nil {
			response.Error(c, err.Error())
			return
		}
		if character == nil || character.ProjectID != projectID {
			response.Error(c, "character not found")
			return
		}
	}

	asset := &models.Asset{
		ProjectID:   projectID,
		CharacterID: req.CharacterID,
		Name:        strings.TrimSpace(req.Name),
		Type:        strings.TrimSpace(req.Type),
		FileURL:     strings.TrimSpace(req.FileURL),
		CoverURL:    "",
		ThumbnailURL: "",
		Meta:        strings.TrimSpace(req.Meta),
	}

	if asset.Name == "" {
		response.Error(c, "name is required")
		return
	}
	if asset.Type == "" {
		response.Error(c, "type is required")
		return
	}

	if err := h.repo.Create(asset); err != nil {
		response.Error(c, err.Error())
		return
	}

	if asset.FileURL != "" {
		h.ensureAssetPreview(c, asset)
	}

	response.Created(c, asset)
}

// Update updates an asset
func (h *AssetHandler) Update(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}

	asset, err := h.repo.FindByID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if asset == nil {
		response.Error(c, "asset not found")
		return
	}

	var req struct {
		CharacterID *int64 `json:"character_id"`
		Name        string `json:"name"`
		Type        string `json:"type"`
		FileURL     string `json:"file_url"`
		Meta        string `json:"meta"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, err.Error())
		return
	}

	if req.CharacterID != nil {
		character, err := h.characterRepo.FindByID(*req.CharacterID)
		if err != nil {
			response.Error(c, err.Error())
			return
		}
		if character == nil || character.ProjectID != asset.ProjectID {
			response.Error(c, "character not found")
			return
		}
	}

	if strings.TrimSpace(req.Name) != "" {
		asset.Name = strings.TrimSpace(req.Name)
	}
	if strings.TrimSpace(req.Type) != "" {
		asset.Type = strings.TrimSpace(req.Type)
	}
	asset.CharacterID = req.CharacterID
	asset.Meta = strings.TrimSpace(req.Meta)

	incomingFileURL := strings.TrimSpace(req.FileURL)
	if incomingFileURL != "" && incomingFileURL != asset.FileURL {
		asset.FileURL = incomingFileURL
		asset.ThumbnailURL = ""
	}

	if err := h.repo.Update(asset); err != nil {
		response.Error(c, err.Error())
		return
	}

	if asset.FileURL != "" && asset.ThumbnailURL == "" {
		h.ensureAssetPreview(c, asset)
	}

	response.Success(c, asset)
}

// GenerateCover generates a cover image for a scene/background asset.
func (h *AssetHandler) GenerateCover(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}

	asset, err := h.repo.FindByID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if asset == nil {
		response.Error(c, "asset not found")
		return
	}
	if !canGenerateSceneAssetCover(asset.Type) {
		response.Error(c, "当前资产类型不支持生成封面")
		return
	}

	wanxClient, err := services.NewWanxClient()
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	prompt := buildAssetCoverPrompt(asset)
	imageURL, err := wanxClient.GenerateImage(c.Request.Context(), prompt)
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	coverURL, previewURL, err := h.generatedImageService.DownloadAndStore(c.Request.Context(), imageURL, "assets", fmt.Sprintf("asset-cover-%d", asset.ID), services.AssetPreviewSpec())
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	asset.CoverURL = coverURL
	asset.ThumbnailURL = previewURL
	if err := h.repo.Update(asset); err != nil {
		response.Error(c, err.Error())
		return
	}

	response.Success(c, asset)
}

// Delete deletes an asset
func (h *AssetHandler) Delete(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}

	asset, err := h.repo.FindByID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if asset == nil {
		response.Error(c, "asset not found")
		return
	}

	usageCount, err := h.usageRepo.CountActiveStoryboardUsageByAssetID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if usageCount > 0 {
		response.Error(c, fmt.Sprintf("该资产已被 %d 个镜头引用，暂不允许删除。请先让相关镜头改用其他资产或重新生成封面。", usageCount))
		return
	}

	if err := h.repo.Delete(id); err != nil {
		response.Error(c, err.Error())
		return
	}

	response.Success(c, gin.H{"success": true})
}

func (h *AssetHandler) ensureAssetPreview(c *gin.Context, asset *models.Asset) {
	if asset == nil {
		return
	}

	sourceURL := strings.TrimSpace(asset.CoverURL)
	if sourceURL == "" {
		sourceURL = strings.TrimSpace(asset.FileURL)
	}
	if sourceURL == "" || strings.TrimSpace(asset.ThumbnailURL) != "" {
		return
	}

	previewURL, err := h.previewService.CreatePreviewFromSource(c.Request.Context(), sourceURL, "assets", fmt.Sprintf("asset-%d", asset.ID), services.AssetPreviewSpec())
	if err != nil {
		log.Printf("failed to generate asset preview for %d: %v", asset.ID, err)
		return
	}
	asset.ThumbnailURL = previewURL
	if err := h.repo.UpdateThumbnailURL(asset.ID, previewURL); err != nil {
		log.Printf("failed to persist asset preview for %d: %v", asset.ID, err)
	}
}

func canGenerateSceneAssetCover(assetType string) bool {
	t := strings.ToLower(strings.TrimSpace(assetType))
	return strings.Contains(t, "scene") || strings.Contains(t, "background") || strings.Contains(t, "场景") || strings.Contains(t, "背景")
}

func buildAssetCoverPrompt(asset *models.Asset) string {
	var b strings.Builder
	b.WriteString("为漫剧分镜系统生成一张场景资产封面图。")
	if asset.Name != "" {
		b.WriteString(" 资产名称：")
		b.WriteString(asset.Name)
		b.WriteString("。")
	}
	if asset.Type != "" {
		b.WriteString(" 资产类型：")
		b.WriteString(asset.Type)
		b.WriteString("。")
	}
	if strings.TrimSpace(asset.Meta) != "" {
		b.WriteString(" 说明：")
		b.WriteString(strings.TrimSpace(asset.Meta))
		b.WriteString("。")
	}
	b.WriteString(" 画面要求：单一场景封面，构图清晰，写实电影感，适合做背景或场景资产预览。")
	b.WriteString(" 输出要求：横版16比9，不要文字、水印、logo、海报排版。")
	return b.String()
}
