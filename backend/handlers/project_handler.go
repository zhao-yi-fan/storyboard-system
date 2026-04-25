package handlers

import (
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"storyboard-backend/models"
	"storyboard-backend/pkg/response"
	"storyboard-backend/repository"
	"storyboard-backend/services"
)

// ProjectHandler handles project-related requests
type ProjectHandler struct {
	repo *repository.ProjectRepository
}

func NewProjectHandler() *ProjectHandler {
	return &ProjectHandler{repo: &repository.ProjectRepository{}}
}

// GetAll returns all projects
func (h *ProjectHandler) GetAll(c *gin.Context) {
	projects, err := h.repo.FindAll()
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	normalizeProjectsWithStatsForResponse(projects)
	response.Success(c, projects)
}

// GetByID returns a project by ID
func (h *ProjectHandler) GetByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}

	project, err := h.repo.FindByID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if project == nil {
		response.Error(c, "project not found")
		return
	}

	normalizeProjectForResponse(project)
	response.Success(c, project)
}

// Create creates a new project
func (h *ProjectHandler) Create(c *gin.Context) {
	var req struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, err.Error())
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		response.Error(c, "项目名称不能为空")
		return
	}

	existing, err := h.repo.FindByName(req.Name)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if existing != nil {
		response.Error(c, "项目名称已存在，请更换名称")
		return
	}

	project := &models.Project{
		Name:        req.Name,
		Description: req.Description,
		ScriptText:  "",
	}

	if err := h.repo.Create(project); err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			response.Error(c, "项目名称已存在，请更换名称")
			return
		}
		response.Error(c, err.Error())
		return
	}

	normalizeProjectForResponse(project)
	response.Created(c, project)
}

// Update updates a project
func (h *ProjectHandler) Update(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}

	project, err := h.repo.FindByID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if project == nil {
		response.Error(c, "project not found")
		return
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		ScriptText  string `json:"script_text"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, err.Error())
		return
	}

	if req.Name != "" {
		req.Name = strings.TrimSpace(req.Name)
		if req.Name == "" {
			response.Error(c, "项目名称不能为空")
			return
		}

		existing, err := h.repo.FindByNameExceptID(req.Name, id)
		if err != nil {
			response.Error(c, err.Error())
			return
		}
		if existing != nil {
			response.Error(c, "项目名称已存在，请更换名称")
			return
		}

		project.Name = req.Name
	}
	project.Description = req.Description
	project.ScriptText = req.ScriptText

	if err := h.repo.Update(project); err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			response.Error(c, "项目名称已存在，请更换名称")
			return
		}
		response.Error(c, err.Error())
		return
	}

	normalizeProjectForResponse(project)
	response.Success(c, project)
}

// Delete deletes a project
func (h *ProjectHandler) Delete(c *gin.Context) {
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

func (h *ProjectHandler) Pin(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}

	project, err := h.repo.FindByID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if project == nil {
		response.Error(c, "project not found")
		return
	}

	if err := h.repo.Pin(id); err != nil {
		response.Error(c, err.Error())
		return
	}

	project, err = h.repo.FindByID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	normalizeProjectForResponse(project)
	response.Success(c, project)
}

func (h *ProjectHandler) Unpin(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}

	project, err := h.repo.FindByID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if project == nil {
		response.Error(c, "project not found")
		return
	}

	if err := h.repo.Unpin(id); err != nil {
		response.Error(c, err.Error())
		return
	}

	project, err = h.repo.FindByID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	normalizeProjectForResponse(project)
	response.Success(c, project)
}

// ComposeVideo composes a project-level rough cut from succeeded scene videos.
func (h *ProjectHandler) ComposeVideo(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}

	project, err := h.repo.FindByID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if project == nil {
		response.Error(c, "project not found")
		return
	}

	var req struct {
		Regenerate *bool `json:"regenerate"`
	}
	if err := c.ShouldBindJSON(&req); err != nil && !strings.Contains(err.Error(), "EOF") {
		response.Error(c, err.Error())
		return
	}

	regenerate := true
	if req.Regenerate != nil {
		regenerate = *req.Regenerate
	}

	service, err := services.NewProjectVideoService()
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	project, err = service.ComposeAndAttach(id, regenerate)
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	normalizeProjectForResponse(project)
	response.Success(c, gin.H{
		"project_id":        project.ID,
		"video_url":         project.VideoURL,
		"video_preview_url": project.VideoPreviewURL,
		"video_status":      project.VideoStatus,
		"video_error":       project.VideoError,
		"video_duration":    project.VideoDuration,
		"project":           project,
	})
}

// ImportScript imports script text into a project, parses it, and persists the generated structure.
func (h *ProjectHandler) ImportScript(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.Error(c, "invalid id")
		return
	}

	var req struct {
		ScriptText string `json:"script_text" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, err.Error())
		return
	}

	project, err := h.repo.FindByID(id)
	if err != nil {
		response.Error(c, err.Error())
		return
	}
	if project == nil {
		response.Error(c, "project not found")
		return
	}

	parser := services.NewLLMScriptParserService()
	result, err := parser.ParseAndImport(id, req.ScriptText)
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	response.Success(c, result)
}
