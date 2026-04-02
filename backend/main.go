package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"storyboard-backend/config"
	"storyboard-backend/database"
	"storyboard-backend/handlers"
	"storyboard-backend/pkg/response"
	"storyboard-backend/services"
)

func main() {
	// Load configuration
	config.Load()

	// Initialize database
	if err := database.Init(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

	// Initialize OSS service (reserved)
	_ = services.NewOSSService()

	// Create Gin router
	r := gin.Default()

	// CORS middleware
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Health check
	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// Initialize handlers
	projectHandler := handlers.NewProjectHandler()
	chapterHandler := handlers.NewChapterHandler()
	sceneHandler := handlers.NewSceneHandler()
	storyboardHandler := handlers.NewStoryboardHandler()
	characterHandler := handlers.NewCharacterHandler()
	assetHandler := handlers.NewAssetHandler()

	// API routes
	api := r.Group("/api")
	{
		// Projects
		projects := api.Group("/projects")
		{
			projects.GET("", projectHandler.GetAll)
			projects.POST("", projectHandler.Create)
			projects.GET("/:id", projectHandler.GetByID)
			projects.PUT("/:id", projectHandler.Update)
			projects.DELETE("/:id", projectHandler.Delete)
			projects.POST("/:id/import-script", projectHandler.ImportScript)

			// Chapters under project
			projects.GET("/:id/chapters", chapterHandler.GetByProject)
			projects.POST("/:id/chapters", chapterHandler.Create)

			// Characters under project
			projects.GET("/:id/characters", characterHandler.GetByProject)
			projects.POST("/:id/characters", characterHandler.Create)

			// Assets under project
			projects.GET("/:id/assets", assetHandler.GetByProject)
		}

		// Chapters
		chapters := api.Group("/chapters")
		{
			chapters.GET("/:id", chapterHandler.GetByID)
			chapters.PUT("/:id", chapterHandler.Update)
			chapters.DELETE("/:id", chapterHandler.Delete)

			// Scenes under chapter
			chapters.GET("/:id/scenes", sceneHandler.GetByChapter)
			chapters.POST("/:id/scenes", sceneHandler.Create)
		}

		// Scenes
		scenes := api.Group("/scenes")
		{
			scenes.GET("/:id", sceneHandler.GetByID)
			scenes.PUT("/:id", sceneHandler.Update)
			scenes.DELETE("/:id", sceneHandler.Delete)

			// Storyboards under scene
			scenes.GET("/:id/storyboards", storyboardHandler.GetByScene)
			scenes.POST("/:id/storyboards", storyboardHandler.Create)
		}

		// Storyboards
		storyboards := api.Group("/storyboards")
		{
			storyboards.GET("/:id", storyboardHandler.GetByID)
			storyboards.PUT("/:id", storyboardHandler.Update)
			storyboards.DELETE("/:id", storyboardHandler.Delete)
			storyboards.POST("/:id/generate-cover", storyboardHandler.GenerateCover)
			storyboards.POST("/:id/generate-video", storyboardHandler.GenerateVideo)
		}

		// Characters
		characters := api.Group("/characters")
		{
			characters.GET("/:id", characterHandler.GetByID)
			characters.PUT("/:id", characterHandler.Update)
			characters.DELETE("/:id", characterHandler.Delete)

			// Assets under character
			characters.GET("/:id/assets", assetHandler.GetByCharacter)
		}

		// Assets
		assets := api.Group("/assets")
		{
			assets.DELETE("/:id", assetHandler.Delete)
		}

		// OSS signature for direct upload
		api.GET("/oss/sign", func(c *gin.Context) {
			oss := services.NewOSSService()
			fileName := c.Query("filename")
			contentType := c.Query("content_type")
			if fileName == "" {
				response.Error(c, "filename is required")
				return
			}
			signature, err := oss.SignUploadURL(fileName, contentType)
			if err != nil {
				response.Error(c, err.Error())
				return
			}
			response.Success(c, signature)
		})
	}

	// Start server
	port := config.GlobalConfig.ServerPort
	log.Printf("Server starting on port %s...", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
