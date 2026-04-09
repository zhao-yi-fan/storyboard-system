package services

import (
	"strings"

	"storyboard-backend/models"
)

const defaultStylePreset = "realistic_cinematic"

var stylePresetPromptMap = map[string]string{
	"realistic_cinematic": "写实电影感，克制光影，真实材质，电影级构图",
	"dark_realism":        "阴郁现实主义，冷色调，压抑氛围，粗粝真实",
	"mystery_thriller":    "悬疑惊悚风格，紧张压迫感，暗部层次明显，气氛不安",
	"youthful_bright":     "青春清透风格，柔和自然光，轻盈干净，人物更有生命力",
	"japanese_animation":  "日式动画感，角色造型统一，画面干净，情绪表达明确",
	"retro_film":          "复古胶片质感，颗粒感，低饱和，怀旧色调",
	"warm_poetic":         "温暖诗意风格，柔和光线，细腻情绪，画面富有呼吸感",
	"cold_noir":           "冷峻黑色电影风格，高反差，冷硬阴影，压迫感强",
}

func resolveStoryboardStylePreset(scene *models.Scene, storyboard *models.Storyboard) string {
	if storyboard != nil {
		if preset := strings.TrimSpace(storyboard.StylePreset); preset != "" {
			return preset
		}
	}
	if scene != nil {
		if preset := strings.TrimSpace(scene.StylePreset); preset != "" {
			return preset
		}
	}
	return defaultStylePreset
}

func resolveStoryboardStyleNotes(scene *models.Scene, storyboard *models.Storyboard) string {
	if storyboard != nil {
		if notes := strings.TrimSpace(storyboard.StyleNotes); notes != "" {
			return notes
		}
	}
	if scene != nil {
		if notes := strings.TrimSpace(scene.StyleNotes); notes != "" {
			return notes
		}
	}
	return ""
}

func stylePresetPrompt(preset string) string {
	preset = strings.TrimSpace(preset)
	if preset == "" {
		preset = defaultStylePreset
	}
	if prompt, ok := stylePresetPromptMap[preset]; ok {
		return prompt
	}
	return stylePresetPromptMap[defaultStylePreset]
}
