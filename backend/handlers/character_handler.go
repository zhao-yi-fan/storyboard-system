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

// CharacterHandler handles character-related requests
type CharacterHandler struct {
	repo                  *repository.CharacterRepository
	projectRepo           *repository.ProjectRepository
	previewService        *services.ImagePreviewService
	generatedImageService *services.GeneratedImageService
	voiceDesignService    *services.VoiceDesignService
}

func NewCharacterHandler() *CharacterHandler {
	return &CharacterHandler{
		repo:                  &repository.CharacterRepository{},
		projectRepo:           &repository.ProjectRepository{},
		previewService:        services.NewImagePreviewService(),
		generatedImageService: services.NewGeneratedImageService(),
		voiceDesignService:    services.NewVoiceDesignService(),
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

	for i := range characters {
		h.ensureAvatarPreview(c, &characters[i])
		h.ensureDesignSheetPreview(c, &characters[i])
	}
	normalizeCharactersForResponse(characters)

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

	h.ensureAvatarPreview(c, character)
	h.ensureDesignSheetPreview(c, character)
	normalizeCharacterForResponse(character)
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
		Name           string `json:"name" binding:"required"`
		Description    string `json:"description"`
		AvatarURL      string `json:"avatar_url"`
		DesignSheetURL string `json:"design_sheet_url"`
		VoicePrompt    string `json:"voice_prompt"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, err.Error())
		return
	}

	character := &models.Character{
		ProjectID:             projectID,
		Name:                  strings.TrimSpace(req.Name),
		Description:           strings.TrimSpace(req.Description),
		AvatarURL:             strings.TrimSpace(req.AvatarURL),
		AvatarPreviewURL:      "",
		DesignSheetURL:        strings.TrimSpace(req.DesignSheetURL),
		DesignSheetPreviewURL: "",
		VoicePrompt:           strings.TrimSpace(req.VoicePrompt),
	}

	if err := h.repo.Create(character); err != nil {
		response.Error(c, err.Error())
		return
	}

	h.ensureAvatarPreview(c, character)
	h.ensureDesignSheetPreview(c, character)
	normalizeCharacterForResponse(character)
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
		Name           *string `json:"name"`
		Description    *string `json:"description"`
		AvatarURL      *string `json:"avatar_url"`
		DesignSheetURL *string `json:"design_sheet_url"`
		VoicePrompt    *string `json:"voice_prompt"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, err.Error())
		return
	}

	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		character.Name = strings.TrimSpace(*req.Name)
	}
	if req.Description != nil {
		character.Description = strings.TrimSpace(*req.Description)
	}
	if req.AvatarURL != nil {
		incomingAvatarURL := strings.TrimSpace(*req.AvatarURL)
		if incomingAvatarURL != character.AvatarURL {
			character.AvatarURL = incomingAvatarURL
			character.AvatarPreviewURL = ""
		}
	}
	if req.DesignSheetURL != nil {
		incomingDesignSheetURL := strings.TrimSpace(*req.DesignSheetURL)
		if incomingDesignSheetURL != character.DesignSheetURL {
			character.DesignSheetURL = incomingDesignSheetURL
			character.DesignSheetPreviewURL = ""
		}
	}
	if req.VoicePrompt != nil {
		character.VoicePrompt = strings.TrimSpace(*req.VoicePrompt)
	}

	if err := h.repo.Update(character); err != nil {
		response.Error(c, err.Error())
		return
	}

	h.ensureAvatarPreview(c, character)
	h.ensureDesignSheetPreview(c, character)
	normalizeCharacterForResponse(character)
	response.Success(c, character)
}

func (h *CharacterHandler) GenerateCover(c *gin.Context) {
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

	wanxClient, err := services.NewWanxClient()
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	prompt := buildCharacterCoverPrompt(character)
	imageURL, err := wanxClient.GenerateImage(c.Request.Context(), prompt)
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	avatarURL, previewURL, err := h.generatedImageService.DownloadAndStore(c.Request.Context(), imageURL, "characters", fmt.Sprintf("character-avatar-%d", character.ID), services.AvatarPreviewSpec())
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	character.AvatarURL = avatarURL
	character.AvatarPreviewURL = previewURL
	if err := h.repo.Update(character); err != nil {
		response.Error(c, err.Error())
		return
	}

	normalizeCharacterForResponse(character)
	response.Success(c, character)
}

func (h *CharacterHandler) GenerateDesignSheet(c *gin.Context) {
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
		Mode string `json:"mode"`
	}
	if err := c.ShouldBindJSON(&req); err != nil && err.Error() != "EOF" {
		response.Error(c, err.Error())
		return
	}

	mode, model := resolveCharacterDesignSheetMode(req.Mode)

	wanxClient, err := services.NewWanxClient()
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	prompt := buildCharacterDesignSheetPrompt(character, mode)
	imageURL, err := wanxClient.GenerateImageWithModel(c.Request.Context(), prompt, model)
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	designSheetURL, previewURL, err := h.generatedImageService.DownloadAndStore(c.Request.Context(), imageURL, "characters", fmt.Sprintf("character-design-sheet-%d", character.ID), services.StoryboardPreviewSpec())
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	character.DesignSheetURL = designSheetURL
	character.DesignSheetPreviewURL = previewURL
	if err := h.repo.Update(character); err != nil {
		response.Error(c, err.Error())
		return
	}

	normalizeCharacterForResponse(character)
	response.Success(c, character)
}

func (h *CharacterHandler) GenerateVoiceReference(c *gin.Context) {
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
		VoicePrompt string `json:"voice_prompt"`
		PreviewText string `json:"preview_text"`
	}
	if err := c.ShouldBindJSON(&req); err != nil && err.Error() != "EOF" {
		response.Error(c, err.Error())
		return
	}

	result, err := h.voiceDesignService.GenerateCharacterVoiceReference(c.Request.Context(), character, strings.TrimSpace(req.VoicePrompt), strings.TrimSpace(req.PreviewText))
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	character.VoiceReferenceURL = result.VoiceReferenceURL
	character.VoiceReferenceDuration = result.VoiceReferenceDuration
	character.VoiceReferenceText = result.VoiceReferenceText
	character.VoiceName = result.VoiceName
	character.VoicePrompt = result.VoicePrompt
	if err := h.repo.Update(character); err != nil {
		response.Error(c, err.Error())
		return
	}

	normalizeCharacterForResponse(character)
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

func (h *CharacterHandler) ensureAvatarPreview(c *gin.Context, character *models.Character) {
	if character == nil {
		return
	}
	if strings.TrimSpace(character.AvatarURL) == "" {
		if character.AvatarPreviewURL != "" {
			character.AvatarPreviewURL = ""
			if err := h.repo.Update(character); err != nil {
				log.Printf("failed to clear character preview: %v", err)
			}
		}
		return
	}
	if strings.TrimSpace(character.AvatarPreviewURL) != "" {
		return
	}

	previewURL, err := h.previewService.CreatePreviewFromSource(c.Request.Context(), character.AvatarURL, "characters", fmt.Sprintf("character-%d", character.ID), services.AvatarPreviewSpec())
	if err != nil {
		log.Printf("failed to generate character preview for %d: %v", character.ID, err)
		return
	}
	character.AvatarPreviewURL = previewURL
	if err := h.repo.Update(character); err != nil {
		log.Printf("failed to persist character preview for %d: %v", character.ID, err)
	}
}

func (h *CharacterHandler) ensureDesignSheetPreview(c *gin.Context, character *models.Character) {
	if character == nil {
		return
	}
	if strings.TrimSpace(character.DesignSheetURL) == "" {
		if character.DesignSheetPreviewURL != "" {
			character.DesignSheetPreviewURL = ""
			if err := h.repo.Update(character); err != nil {
				log.Printf("failed to clear design sheet preview: %v", err)
			}
		}
		return
	}
	if strings.TrimSpace(character.DesignSheetPreviewURL) != "" {
		return
	}

	previewURL, err := h.previewService.CreatePreviewFromSource(c.Request.Context(), character.DesignSheetURL, "characters", fmt.Sprintf("character-design-sheet-%d", character.ID), services.StoryboardPreviewSpec())
	if err != nil {
		log.Printf("failed to generate design sheet preview for %d: %v", character.ID, err)
		return
	}
	character.DesignSheetPreviewURL = previewURL
	if err := h.repo.Update(character); err != nil {
		log.Printf("failed to persist design sheet preview for %d: %v", character.ID, err)
	}
}

func buildCharacterCoverPrompt(character *models.Character) string {
	var b strings.Builder
	b.WriteString("为漫剧分镜系统生成一张角色封面头像。")
	if character.Name != "" {
		b.WriteString(" 角色名称：")
		b.WriteString(character.Name)
		b.WriteString("。")
	}
	if strings.TrimSpace(character.Description) != "" {
		b.WriteString(" 角色描述：")
		b.WriteString(strings.TrimSpace(character.Description))
		b.WriteString("。")
	}
	b.WriteString(" 画面要求：单人角色肖像，主体明确，构图干净，适合在资产库中展示。")
	b.WriteString(" 风格要求：写实电影感，细节自然，避免夸张漫画化。")
	b.WriteString(" 输出要求：不要文字、水印、logo、海报排版。")
	return b.String()
}

func buildCharacterDesignSheetPrompt(character *models.Character, mode string) string {
	var b strings.Builder
	b.WriteString("为漫剧分镜系统生成角色主设定图。")
	if character.Name != "" {
		b.WriteString(" 角色名称：")
		b.WriteString(character.Name)
		b.WriteString("。")
	}
	if desc := strings.TrimSpace(character.Description); desc != "" {
		b.WriteString(" 角色描述：")
		b.WriteString(desc)
		b.WriteString("。")
	}
	if mode == "draft" {
		b.WriteString(" 目标：快速确定角色长相、发型、服装和整体气质。")
	} else {
		b.WriteString(" 目标：输出最终定稿级角色设定板，作为后续镜头封面的核心参考图。")
	}
	b.WriteString(" 画面要求：单张角色设定板，包含同一角色的正面全身、侧面全身、背面全身，以及半身近景头像。")
	b.WriteString(" 一致性要求：保持同一人物的脸型、五官、发型、发色、服装结构、配饰位置和身材比例完全一致。")
	b.WriteString(" 背景要求：纯净浅色背景或白底，不要剧情场景，不要复杂道具。")
	b.WriteString(" 输出要求：不要文字说明、不要水印、不要 logo、不要海报排版。")
	return b.String()
}

func resolveCharacterDesignSheetMode(raw string) (string, string) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "draft":
		return "draft", "qwen-image-2.0"
	default:
		return "final", "wan2.7-image-pro"
	}
}
