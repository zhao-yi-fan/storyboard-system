package handlers

import (
	"storyboard-backend/models"
	"storyboard-backend/services"
)

func normalizeProjectForResponse(project *models.Project) {
	if project == nil {
		return
	}
	oss := services.NewOSSService()
	project.VideoURL = oss.ResolveGeneratedURL(project.VideoURL)
	project.VideoPreviewURL = oss.ResolveGeneratedURL(project.VideoPreviewURL)
}

func normalizeSceneForResponse(scene *models.Scene) {
	if scene == nil {
		return
	}
	oss := services.NewOSSService()
	scene.CoverURL = oss.ResolveGeneratedURL(scene.CoverURL)
	scene.CoverPreviewURL = oss.ResolveGeneratedURL(scene.CoverPreviewURL)
	scene.VideoURL = oss.ResolveGeneratedURL(scene.VideoURL)
	scene.VideoPreviewURL = oss.ResolveGeneratedURL(scene.VideoPreviewURL)
}

func normalizeStoryboardForResponse(storyboard *models.Storyboard) {
	if storyboard == nil {
		return
	}
	oss := services.NewOSSService()
	storyboard.ThumbnailURL = oss.ResolveGeneratedURL(storyboard.ThumbnailURL)
	storyboard.ThumbnailPreviewURL = oss.ResolveGeneratedURL(storyboard.ThumbnailPreviewURL)
	storyboard.VideoURL = oss.ResolveGeneratedURL(storyboard.VideoURL)
	storyboard.VideoPreviewURL = oss.ResolveGeneratedURL(storyboard.VideoPreviewURL)
	for i := range storyboard.Characters {
		normalizeCharacterForResponse(&storyboard.Characters[i])
	}
}

func normalizeCharacterForResponse(character *models.Character) {
	if character == nil {
		return
	}
	oss := services.NewOSSService()
	character.AvatarURL = oss.ResolveGeneratedURL(character.AvatarURL)
	character.AvatarPreviewURL = oss.ResolveGeneratedURL(character.AvatarPreviewURL)
	character.DesignSheetURL = oss.ResolveGeneratedURL(character.DesignSheetURL)
	character.DesignSheetPreviewURL = oss.ResolveGeneratedURL(character.DesignSheetPreviewURL)
}

func normalizeAssetForResponse(asset *models.Asset) {
	if asset == nil {
		return
	}
	oss := services.NewOSSService()
	asset.FileURL = oss.ResolveGeneratedURL(asset.FileURL)
	asset.CoverURL = oss.ResolveGeneratedURL(asset.CoverURL)
	asset.ThumbnailURL = oss.ResolveGeneratedURL(asset.ThumbnailURL)
}

func normalizeMediaGenerationForResponse(item *models.StoryboardMediaGeneration) {
	if item == nil {
		return
	}
	oss := services.NewOSSService()
	item.ResultURL = oss.ResolveGeneratedURL(item.ResultURL)
	item.PreviewURL = oss.ResolveGeneratedURL(item.PreviewURL)
	item.SourceURL = oss.ResolveGeneratedURL(item.SourceURL)
}

func normalizeProjectsForResponse(items []models.Project) {
	for i := range items {
		normalizeProjectForResponse(&items[i])
	}
}

func normalizeProjectsWithStatsForResponse(items []models.ProjectWithStats) {
	for i := range items {
		normalizeProjectForResponse(&items[i].Project)
	}
}

func normalizeScenesForResponse(items []models.Scene) {
	for i := range items {
		normalizeSceneForResponse(&items[i])
	}
}

func normalizeStoryboardsForResponse(items []models.Storyboard) {
	for i := range items {
		normalizeStoryboardForResponse(&items[i])
	}
}

func normalizeCharactersForResponse(items []models.Character) {
	for i := range items {
		normalizeCharacterForResponse(&items[i])
	}
}

func normalizeAssetsForResponse(items []models.Asset) {
	for i := range items {
		normalizeAssetForResponse(&items[i])
	}
}

func normalizeMediaGenerationsForResponse(items []models.StoryboardMediaGeneration) {
	for i := range items {
		normalizeMediaGenerationForResponse(&items[i])
	}
}
