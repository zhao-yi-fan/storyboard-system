package services

import (
	"database/sql"
	"fmt"
	"regexp"
	"strings"

	"storyboard-backend/database"
)

type ScriptImportResult struct {
	ProjectID       int64 `json:"project_id"`
	ChapterCount    int   `json:"chapter_count"`
	SceneCount      int   `json:"scene_count"`
	StoryboardCount int   `json:"storyboard_count"`
	CharacterCount  int   `json:"character_count"`
}

type ScriptParserService struct{}

type parsedScript struct {
	Chapters []parsedChapter
}

type parsedChapter struct {
	Title     string
	Summary   string
	SortOrder int
	Scenes    []parsedScene
}

type parsedScene struct {
	Title       string
	Description string
	Location    string
	TimeOfDay   string
	SortOrder   int
	Storyboards []parsedStoryboard
}

type parsedStoryboard struct {
	Content         string
	CameraDirection string
	Duration        float64
	Background      string
	Notes           string
	CharacterNames  []string
}

var (
	chapterLineRe  = regexp.MustCompile(`^第[一二三四五六七八九十百千0-9]+(?:章|卷|部|集|篇)?[：:\s-]*(.+)$`)
	sceneLineRe    = regexp.MustCompile(`^场景\s*[0-9一二三四五六七八九十百千]*[：:\s-]*(.+)$`)
	bracketLineRe  = regexp.MustCompile(`^[【\[](.*)[】\]]$`)
	dialogueLineRe = regexp.MustCompile(`^([^：:（(\[]+?)(?:[（(]([^）)]+)[）)])?[:：](.+)$`)
)

func NewScriptParserService() *ScriptParserService {
	return &ScriptParserService{}
}

func (s *ScriptParserService) ParseAndImport(projectID int64, scriptText string) (*ScriptImportResult, error) {
	cleaned := strings.TrimSpace(scriptText)
	if cleaned == "" {
		return nil, fmt.Errorf("script text is empty")
	}

	parsed := parseScript(cleaned)
	if len(parsed.Chapters) == 0 {
		return nil, fmt.Errorf("failed to parse script into chapters")
	}

	tx, err := database.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`UPDATE projects SET script_text = ? WHERE id = ? AND deleted_at IS NULL`, cleaned, projectID); err != nil {
		return nil, err
	}

	if err := resetProjectStructure(tx, projectID); err != nil {
		return nil, err
	}

	characterIDs, err := loadCharacterIDs(tx, projectID)
	if err != nil {
		return nil, err
	}

	result := &ScriptImportResult{ProjectID: projectID}
	parsedCharacters := map[string]struct{}{}

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
					parsedCharacters[name] = struct{}{}
					characterID, ok := characterIDs[name]
					if !ok {
						characterID, err = insertCharacter(tx, projectID, name)
						if err != nil {
							return nil, err
						}
						characterIDs[name] = characterID
					}
					if err := insertStoryboardCharacter(tx, storyboardID, characterID, storyboard.Content); err != nil {
						return nil, err
					}
				}
			}
		}
	}

	result.CharacterCount = len(parsedCharacters)

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return result, nil
}

func resetProjectStructure(tx *sql.Tx, projectID int64) error {
	if _, err := tx.Exec(`
		DELETE sc FROM storyboard_characters sc
		JOIN storyboards sb ON sc.storyboard_id = sb.id
		WHERE sb.project_id = ?
	`, projectID); err != nil {
		return err
	}
	if _, err := tx.Exec(`UPDATE storyboards SET deleted_at = NOW() WHERE project_id = ? AND deleted_at IS NULL`, projectID); err != nil {
		return err
	}
	if _, err := tx.Exec(`UPDATE scenes SET deleted_at = NOW() WHERE project_id = ? AND deleted_at IS NULL`, projectID); err != nil {
		return err
	}
	if _, err := tx.Exec(`UPDATE chapters SET deleted_at = NOW() WHERE project_id = ? AND deleted_at IS NULL`, projectID); err != nil {
		return err
	}
	return nil
}

func loadCharacterIDs(tx *sql.Tx, projectID int64) (map[string]int64, error) {
	rows, err := tx.Query(`SELECT id, name FROM characters WHERE project_id = ? AND deleted_at IS NULL`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]int64)
	for rows.Next() {
		var id int64
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			return nil, err
		}
		result[strings.TrimSpace(name)] = id
	}
	return result, rows.Err()
}

func insertChapter(tx *sql.Tx, projectID int64, chapter parsedChapter, sortOrder int) (int64, error) {
	result, err := tx.Exec(`INSERT INTO chapters (project_id, title, summary, sort_order) VALUES (?, ?, ?, ?)`, projectID, chapter.Title, chapter.Summary, sortOrder)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func insertScene(tx *sql.Tx, projectID, chapterID int64, scene parsedScene, sortOrder int) (int64, error) {
	result, err := tx.Exec(`
		INSERT INTO scenes (chapter_id, project_id, title, description, location, time_of_day, sort_order)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, chapterID, projectID, scene.Title, scene.Description, scene.Location, scene.TimeOfDay, sortOrder)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func insertStoryboard(tx *sql.Tx, projectID, chapterID, sceneID int64, storyboard parsedStoryboard, shotNumber int) (int64, error) {
	result, err := tx.Exec(`
		INSERT INTO storyboards (scene_id, chapter_id, project_id, shot_number, content, camera_direction, duration, background, thumbnail_url, notes, sort_order)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)
	`, sceneID, chapterID, projectID, shotNumber, storyboard.Content, storyboard.CameraDirection, storyboard.Duration, storyboard.Background, storyboard.Notes, shotNumber)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func insertCharacter(tx *sql.Tx, projectID int64, name string) (int64, error) {
	result, err := tx.Exec(`INSERT INTO characters (project_id, name, description, avatar_url) VALUES (?, ?, '', '')`, projectID, name)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func insertStoryboardCharacter(tx *sql.Tx, storyboardID, characterID int64, line string) error {
	_, err := tx.Exec(`
		INSERT INTO storyboard_characters (storyboard_id, character_id, line)
		VALUES (?, ?, ?)
		ON DUPLICATE KEY UPDATE line = VALUES(line)
	`, storyboardID, characterID, line)
	return err
}

func parseScript(script string) parsedScript {
	var parsed parsedScript
	var currentChapter *parsedChapter
	var currentScene *parsedScene

	ensureChapter := func() *parsedChapter {
		if currentChapter == nil {
			parsed.Chapters = append(parsed.Chapters, parsedChapter{
				Title:     "第一章",
				Summary:   "根据导入剧本自动生成",
				SortOrder: len(parsed.Chapters) + 1,
			})
			currentChapter = &parsed.Chapters[len(parsed.Chapters)-1]
		}
		return currentChapter
	}

	ensureScene := func() *parsedScene {
		chapter := ensureChapter()
		if currentScene == nil {
			chapter.Scenes = append(chapter.Scenes, parsedScene{
				Title:     fmt.Sprintf("场景%d", len(chapter.Scenes)+1),
				SortOrder: len(chapter.Scenes) + 1,
			})
			currentScene = &chapter.Scenes[len(chapter.Scenes)-1]
		}
		return currentScene
	}

	lines := strings.Split(strings.ReplaceAll(script, "\r\n", "\n"), "\n")
	for _, rawLine := range lines {
		line := strings.TrimSpace(rawLine)
		if line == "" {
			continue
		}

		if title, ok := parseChapterTitle(line); ok {
			parsed.Chapters = append(parsed.Chapters, parsedChapter{
				Title:     title,
				SortOrder: len(parsed.Chapters) + 1,
			})
			currentChapter = &parsed.Chapters[len(parsed.Chapters)-1]
			currentScene = nil
			continue
		}

		if title, ok := parseSceneTitle(line); ok {
			chapter := ensureChapter()
			chapter.Scenes = append(chapter.Scenes, parsedScene{
				Title:     title,
				Location:  inferLocation(title),
				TimeOfDay: inferTimeOfDay(title),
				SortOrder: len(chapter.Scenes) + 1,
			})
			currentScene = &chapter.Scenes[len(chapter.Scenes)-1]
			continue
		}

		scene := ensureScene()

		if description, ok := parseBracketDescription(line); ok {
			scene.Description = appendParagraph(scene.Description, description)
			if scene.Location == "" {
				scene.Location = inferLocation(description, scene.Title)
			}
			if scene.TimeOfDay == "" {
				scene.TimeOfDay = inferTimeOfDay(description + " " + scene.Title)
			}
			if len(scene.Storyboards) == 0 {
				scene.Storyboards = append(scene.Storyboards, parsedStoryboard{
					Content:         description,
					CameraDirection: inferCameraDirection(description, false),
					Duration:        5,
					Background:      nonEmpty(scene.Title, description),
					Notes:           "场景建立镜头",
				})
			}
			continue
		}

		if speaker, state, speech, ok := parseDialogue(line); ok {
			scene.Storyboards = append(scene.Storyboards, parsedStoryboard{
				Content:         fmt.Sprintf("%s：%s", speaker, strings.TrimSpace(speech)),
				CameraDirection: inferCameraDirection(line, true),
				Duration:        inferDuration(line, true),
				Background:      nonEmpty(scene.Description, scene.Title),
				Notes:           strings.TrimSpace(state),
				CharacterNames:  []string{strings.TrimSpace(speaker)},
			})
			continue
		}

		scene.Storyboards = append(scene.Storyboards, parsedStoryboard{
			Content:         line,
			CameraDirection: inferCameraDirection(line, false),
			Duration:        inferDuration(line, false),
			Background:      nonEmpty(scene.Description, scene.Title),
			Notes:           inferNote(line),
		})
	}

	for ci := range parsed.Chapters {
		chapter := &parsed.Chapters[ci]
		if chapter.Summary == "" {
			chapter.Summary = buildChapterSummary(*chapter)
		}
		for si := range chapter.Scenes {
			scene := &chapter.Scenes[si]
			if scene.Location == "" {
				scene.Location = inferLocation(scene.Title, scene.Description)
			}
			if scene.TimeOfDay == "" {
				scene.TimeOfDay = inferTimeOfDay(scene.Title + " " + scene.Description)
			}
			if len(scene.Storyboards) == 0 {
				scene.Storyboards = append(scene.Storyboards, parsedStoryboard{
					Content:         nonEmpty(scene.Description, scene.Title),
					CameraDirection: "全景",
					Duration:        5,
					Background:      nonEmpty(scene.Description, scene.Title),
				})
			}
		}
	}

	return parsed
}

func parseChapterTitle(line string) (string, bool) {
	matches := chapterLineRe.FindStringSubmatch(line)
	if len(matches) != 2 {
		return "", false
	}
	title := strings.TrimSpace(matches[1])
	if title == "" {
		return line, true
	}
	return strings.TrimSpace(strings.Split(line, title)[0] + title), true
}

func parseSceneTitle(line string) (string, bool) {
	matches := sceneLineRe.FindStringSubmatch(line)
	if len(matches) != 2 {
		return "", false
	}
	title := strings.TrimSpace(matches[1])
	if title == "" {
		return line, true
	}
	return title, true
}

func parseBracketDescription(line string) (string, bool) {
	matches := bracketLineRe.FindStringSubmatch(line)
	if len(matches) != 2 {
		return "", false
	}
	return strings.TrimSpace(matches[1]), true
}

func parseDialogue(line string) (speaker string, state string, speech string, ok bool) {
	matches := dialogueLineRe.FindStringSubmatch(line)
	if len(matches) != 4 {
		return "", "", "", false
	}
	speaker = strings.TrimSpace(matches[1])
	state = strings.TrimSpace(matches[2])
	speech = strings.TrimSpace(matches[3])
	if speaker == "" || speech == "" {
		return "", "", "", false
	}
	return speaker, state, speech, true
}

func buildChapterSummary(chapter parsedChapter) string {
	if len(chapter.Scenes) == 0 {
		return "根据导入剧本自动生成"
	}
	titles := make([]string, 0, len(chapter.Scenes))
	for _, scene := range chapter.Scenes {
		titles = append(titles, scene.Title)
		if len(titles) == 3 {
			break
		}
	}
	return "包含场景：" + strings.Join(titles, "、")
}

func appendParagraph(base, next string) string {
	next = strings.TrimSpace(next)
	if next == "" {
		return base
	}
	if base == "" {
		return next
	}
	return base + "\n" + next
}

func inferLocation(values ...string) string {
	joined := strings.Join(values, " ")
	for _, separator := range []string{"-", "—", "–", "·", ":", "："} {
		if strings.Contains(joined, separator) {
			parts := strings.Split(joined, separator)
			candidate := strings.TrimSpace(parts[len(parts)-1])
			if candidate != "" && utf8Len(candidate) <= 20 {
				return candidate
			}
		}
	}
	for _, keyword := range []string{"天台", "校园", "教室", "咖啡厅", "会议室", "办公室", "街道", "地铁", "公园", "森林", "山洞", "房间", "客厅", "医院"} {
		if strings.Contains(joined, keyword) {
			return keyword
		}
	}
	return ""
}

func inferTimeOfDay(text string) string {
	switch {
	case strings.Contains(text, "夜"), strings.Contains(text, "晚"), strings.Contains(text, "霓虹"):
		return "夜晚"
	case strings.Contains(text, "清晨"), strings.Contains(text, "黎明"):
		return "清晨"
	case strings.Contains(text, "黄昏"), strings.Contains(text, "傍晚"):
		return "傍晚"
	case strings.Contains(text, "白天"), strings.Contains(text, "阳光"), strings.Contains(text, "午后"):
		return "白天"
	default:
		return ""
	}
}

func inferCameraDirection(text string, dialogue bool) string {
	switch {
	case strings.Contains(text, "特写"):
		return "特写"
	case strings.Contains(text, "中景"):
		return "中景"
	case strings.Contains(text, "近景"):
		return "近景"
	case strings.Contains(text, "全景"):
		return "全景"
	case strings.Contains(text, "俯视"):
		return "俯视"
	case strings.Contains(text, "仰视"):
		return "仰视"
	case strings.Contains(text, "推进"), strings.Contains(text, "推近"):
		return "推镜"
	case strings.Contains(text, "跟拍"):
		return "跟拍"
	case dialogue:
		return "中景"
	default:
		return "全景"
	}
}

func inferDuration(text string, dialogue bool) float64 {
	if dialogue {
		return 4
	}
	if strings.Contains(text, "快速") || strings.Contains(text, "突然") {
		return 3
	}
	if strings.Contains(text, "缓慢") || strings.Contains(text, "凝视") {
		return 6
	}
	return 5
}

func inferNote(text string) string {
	switch {
	case strings.Contains(text, "回忆"):
		return "回忆段落"
	case strings.Contains(text, "电话"), strings.Contains(text, "铃声"):
		return "注意音效节奏"
	default:
		return ""
	}
}

func nonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func uniqueNonEmpty(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func utf8Len(s string) int {
	return len([]rune(strings.TrimSpace(s)))
}
