package handlers

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"storyboard-backend/models"
	"storyboard-backend/repository"
	"storyboard-backend/pkg/response"
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

	project := &models.Project{
		Name:        req.Name,
		Description: req.Description,
		ScriptText:  "",
	}

	if err := h.repo.Create(project); err != nil {
		response.Error(c, err.Error())
		return
	}

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
		project.Name = req.Name
	}
	project.Description = req.Description
	project.ScriptText = req.ScriptText

	if err := h.repo.Update(project); err != nil {
		response.Error(c, err.Error())
		return
	}

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

// ImportScript imports script text into a project
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

	if err := h.repo.UpdateScriptText(id, req.ScriptText); err != nil {
		response.Error(c, err.Error())
		return
	}

	// For now, we just save the script. Actual parsing will be added later with model integration.
	data := gin.H{
		"project_id": id,
		"script_length": len(req.ScriptText),
		"success": true,
	}
	response.Success(c, data)
}
