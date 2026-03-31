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

	parser := services.NewScriptParserService()
	result, err := parser.ParseAndImport(id, req.ScriptText)
	if err != nil {
		response.Error(c, err.Error())
		return
	}

	response.Success(c, result)
}
