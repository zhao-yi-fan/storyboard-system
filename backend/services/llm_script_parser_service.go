package services

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"unicode/utf8"

	"storyboard-backend/database"
)

const defaultMaxScriptRunes = 12000

type LLMScriptParserService struct {
	client         llmScriptModelClient
	maxScriptRunes int
}

func NewLLMScriptParserService() *LLMScriptParserService {
	return &LLMScriptParserService{
		client:         NewDeepSeekClient(),
		maxScriptRunes: defaultMaxScriptRunes,
	}
}

func NewLLMScriptParserServiceWithClient(client llmScriptModelClient, maxScriptRunes int) *LLMScriptParserService {
	if maxScriptRunes <= 0 {
		maxScriptRunes = defaultMaxScriptRunes
	}
	return &LLMScriptParserService{
		client:         client,
		maxScriptRunes: maxScriptRunes,
	}
}

func (s *LLMScriptParserService) ParseAndImport(projectID int64, scriptText string) (*ScriptImportResult, error) {
	cleaned := strings.TrimSpace(scriptText)
	if cleaned == "" {
		return nil, fmt.Errorf("script text is empty")
	}
	if utf8.RuneCountInString(cleaned) > s.maxScriptRunes {
		return nil, fmt.Errorf("文本过长，请分段导入或缩短内容")
	}

	document, err := s.client.ParseScript(context.Background(), cleaned)
	if err != nil {
		return nil, err
	}

	parsed, characterDetails, err := normalizeLLMStoryboardDocument(document)
	if err != nil {
		return nil, err
	}

	tx, err := database.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if err := resetProjectStructure(tx, projectID); err != nil {
		return nil, err
	}

	existingCharacterIDs, err := loadCharacterIDs(tx, projectID)
	if err != nil {
		return nil, err
	}

	result := &ScriptImportResult{ProjectID: projectID}
	parsedCharacters := map[string]struct{}{}

	for name, detail := range characterDetails {
		parsedCharacters[name] = struct{}{}
		if _, err := upsertCharacterWithDetail(tx, projectID, name, detail, existingCharacterIDs); err != nil {
			return nil, err
		}
	}

	for chapterIndex, chapter := range parsed.Chapters {
		chapterID, err := insertChapter(tx, projectID, chapter, chapterIndex+1)
		if err != nil {
			return nil, err
		}
		result.ChapterCount++

		for sceneIndex, scene := range chapter.Scenes {
			sceneID, err := insertScene(tx, projectID, chapterID, scene, sceneIndex+1)
			if err != nil {
				return nil, err
			}
			result.SceneCount++

			for shotIndex, storyboard := range scene.Storyboards {
				storyboardID, err := insertStoryboard(tx, projectID, chapterID, sceneID, storyboard, shotIndex+1)
				if err != nil {
					return nil, err
				}
				result.StoryboardCount++

				for _, name := range uniqueNonEmpty(storyboard.CharacterNames) {
					if name == "" {
						continue
					}
					parsedCharacters[name] = struct{}{}
					characterID, err := upsertCharacterWithDetail(tx, projectID, name, characterDetails[name], existingCharacterIDs)
					if err != nil {
						return nil, err
					}
					line := strings.TrimSpace(storyboard.Dialogue)
					if line == "" {
						line = storyboard.Content
					}
					if err := insertStoryboardCharacter(tx, storyboardID, characterID, line); err != nil {
						return nil, err
					}
				}
			}
		}
	}

	if _, err := tx.Exec(`UPDATE projects SET script_text = ? WHERE id = ? AND deleted_at IS NULL`, cleaned, projectID); err != nil {
		return nil, err
	}

	result.CharacterCount = len(parsedCharacters)

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return result, nil
}

func normalizeLLMStoryboardDocument(document *llmStoryboardDocument) (parsedScript, map[string]llmCharacter, error) {
	if document == nil {
		return parsedScript{}, nil, fmt.Errorf("DeepSeek 解析失败：未返回结构化结果")
	}

	normalizedCharacters := make(map[string]llmCharacter)
	for _, character := range document.Characters {
		name := strings.TrimSpace(character.Name)
		if !isLikelyCharacterName(name) {
			continue
		}

		character.Name = name
		character.Description = strings.TrimSpace(character.Description)
		character.Appearance = strings.TrimSpace(character.Appearance)
		character.Tags = uniqueNonEmpty(character.Tags)
		normalizedCharacters[name] = character
	}

	if len(document.Chapters) == 0 {
		return parsedScript{}, nil, fmt.Errorf("DeepSeek 解析失败：未识别出章节")
	}

	parsed := parsedScript{Chapters: make([]parsedChapter, 0, len(document.Chapters))}
	for chapterIndex, chapter := range document.Chapters {
		chapterTitle := strings.TrimSpace(chapter.Title)
		chapterSummary := strings.TrimSpace(chapter.Summary)
		if chapterTitle == "" {
			return parsedScript{}, nil, fmt.Errorf("DeepSeek 解析失败：第 %d 个章节缺少标题", chapterIndex+1)
		}
		if chapterSummary == "" {
			return parsedScript{}, nil, fmt.Errorf("DeepSeek 解析失败：章节《%s》缺少摘要", chapterTitle)
		}
		if len(chapter.Scenes) == 0 {
			return parsedScript{}, nil, fmt.Errorf("DeepSeek 解析失败：章节《%s》没有场景", chapterTitle)
		}

		parsedChapterItem := parsedChapter{
			Title:     chapterTitle,
			Summary:   chapterSummary,
			SortOrder: normalizedPositiveOrder(chapter.Order, chapterIndex+1),
			Scenes:    make([]parsedScene, 0, len(chapter.Scenes)),
		}

		for sceneIndex, scene := range chapter.Scenes {
			sceneTitle := strings.TrimSpace(scene.Title)
			sceneSummary := strings.TrimSpace(scene.Summary)
			if sceneTitle == "" {
				return parsedScript{}, nil, fmt.Errorf("DeepSeek 解析失败：章节《%s》的第 %d 个场景缺少标题", chapterTitle, sceneIndex+1)
			}
			if sceneSummary == "" {
				return parsedScript{}, nil, fmt.Errorf("DeepSeek 解析失败：场景《%s》缺少摘要", sceneTitle)
			}
			if len(scene.Storyboards) == 0 {
				return parsedScript{}, nil, fmt.Errorf("DeepSeek 解析失败：场景《%s》没有分镜", sceneTitle)
			}

			sceneCharacters := normalizeCharacterNames(scene.Characters)
			parsedSceneItem := parsedScene{
				Title:       sceneTitle,
				Description: sceneSummary,
				Location:    strings.TrimSpace(scene.Location),
				TimeOfDay:   strings.TrimSpace(scene.TimeOfDay),
				SortOrder:   normalizedPositiveOrder(scene.Order, sceneIndex+1),
				Storyboards: make([]parsedStoryboard, 0, len(scene.Storyboards)),
			}

			for storyboardIndex, storyboard := range scene.Storyboards {
				visualDescription := normalizeVisualDescription(storyboard.VisualDescription, storyboard.Notes, storyboard.Dialogue, sceneSummary)
				if visualDescription == "" {
					return parsedScript{}, nil, fmt.Errorf("DeepSeek 解析失败：场景《%s》的第 %d 个分镜缺少 visual_description", sceneTitle, storyboardIndex+1)
				}

				shotCharacters := normalizeCharacterNames(append(sceneCharacters, storyboard.Characters...))
				for _, name := range shotCharacters {
					if _, ok := normalizedCharacters[name]; !ok {
						normalizedCharacters[name] = llmCharacter{Name: name, Tags: []string{}}
					}
				}

				parsedStoryboardItem := parsedStoryboard{
					Content:         visualDescription,
					Dialogue:        strings.TrimSpace(storyboard.Dialogue),
					ShotType:        strings.TrimSpace(storyboard.ShotType),
					Mood:            strings.TrimSpace(storyboard.Mood),
					CameraDirection: nonEmpty(strings.TrimSpace(storyboard.CameraAngle), "平视"),
					CameraMotion:    "",
					Duration:        normalizeDuration(storyboard.DurationSeconds),
					Background:      buildStoryboardBackground(parsedSceneItem.Title, parsedSceneItem.Location, parsedSceneItem.TimeOfDay),
					Notes:           buildStoryboardNotes(storyboard),
					CharacterNames:  shotCharacters,
				}

				parsedSceneItem.Storyboards = append(parsedSceneItem.Storyboards, parsedStoryboardItem)
			}

			parsedChapterItem.Scenes = append(parsedChapterItem.Scenes, parsedSceneItem)
		}

		parsed.Chapters = append(parsed.Chapters, parsedChapterItem)
	}

	return parsed, normalizedCharacters, nil
}

func upsertCharacterWithDetail(tx *sql.Tx, projectID int64, name string, detail llmCharacter, existing map[string]int64) (int64, error) {
	if id, ok := existing[name]; ok {
		description := buildCharacterDescription(detail)
		if _, err := tx.Exec(`UPDATE characters SET description = ? WHERE id = ?`, description, id); err != nil {
			return 0, err
		}
		return id, nil
	}

	description := buildCharacterDescription(detail)
	result, err := tx.Exec(`INSERT INTO characters (project_id, name, description, avatar_url) VALUES (?, ?, ?, '')`, projectID, name, description)
	if err != nil {
		return 0, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}
	existing[name] = id
	return id, nil
}

func buildCharacterDescription(detail llmCharacter) string {
	return strings.TrimSpace(strings.Join(filterNonEmptyStrings([]string{
		strings.TrimSpace(detail.Description),
		prefixIfNotEmpty("外貌：", strings.TrimSpace(detail.Appearance)),
		prefixIfNotEmpty("标签：", strings.Join(uniqueNonEmpty(detail.Tags), "、")),
	}), "\n"))
}

func buildStoryboardNotes(storyboard llmStoryboard) string {
	return strings.TrimSpace(storyboard.Notes)
}

func buildStoryboardBackground(title, location, timeOfDay string) string {
	return strings.TrimSpace(strings.Join(filterNonEmptyStrings([]string{
		strings.TrimSpace(title),
		strings.TrimSpace(location),
		strings.TrimSpace(timeOfDay),
	}), " · "))
}

func normalizeDuration(duration float64) float64 {
	if duration <= 0 {
		return 5
	}
	return duration
}

func normalizeVisualDescription(visualDescription, notes, dialogue, sceneSummary string) string {
	for _, candidate := range []string{
		strings.TrimSpace(visualDescription),
		strings.TrimSpace(notes),
		strings.TrimSpace(dialogue),
		strings.TrimSpace(sceneSummary),
	} {
		if candidate != "" {
			return candidate
		}
	}
	return ""
}

func normalizedPositiveOrder(value, fallback int) int {
	if value > 0 {
		return value
	}
	return fallback
}

func filterNonEmptyStrings(values []string) []string {
	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func normalizeCharacterNames(values []string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		name := strings.TrimSpace(value)
		if !isLikelyCharacterName(name) {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		result = append(result, name)
	}
	return result
}

func isLikelyCharacterName(name string) bool {
	name = strings.TrimSpace(name)
	if name == "" {
		return false
	}

	runeCount := utf8.RuneCountInString(name)
	if runeCount > 12 {
		return false
	}

	if strings.ContainsAny(name, "·，,。：:；;、（）()《》[]【】/|") {
		return false
	}

	if containsAnyKeyword(name, []string{
		"场景", "地点", "时间", "夜晚", "深夜", "凌晨", "清晨", "黄昏", "傍晚", "中午", "下午", "晚上",
		"雨夜", "旧城区", "城区", "小巷", "街道", "天台", "校园", "车站", "仓库", "门口", "室内", "室外",
		"照相馆", "办公室", "病房", "公园", "广场", "走廊", "房间", "废弃",
	}) {
		return false
	}

	return true
}

func containsAnyKeyword(value string, keywords []string) bool {
	for _, keyword := range keywords {
		if strings.Contains(value, keyword) {
			return true
		}
	}
	return false
}

func prefixIfNotEmpty(prefix, value string) string {
	if strings.TrimSpace(value) == "" {
		return ""
	}
	return prefix + value
}
