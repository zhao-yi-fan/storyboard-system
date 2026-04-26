package services

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"storyboard-backend/config"
	"storyboard-backend/models"
	"storyboard-backend/repository"
)

type SceneCoverService struct {
	sceneRepo      *repository.SceneRepository
	storyboardRepo *repository.StoryboardRepository
	wanxClient     *WanxClient
	httpClient     *http.Client
	previewService *ImagePreviewService
	ossService     *OSSService
}

func NewSceneCoverService() (*SceneCoverService, error) {
	wanxClient, err := NewWanxClient()
	if err != nil {
		return nil, err
	}

	return &SceneCoverService{
		sceneRepo:      &repository.SceneRepository{},
		storyboardRepo: &repository.StoryboardRepository{},
		wanxClient:     wanxClient,
		httpClient:     &http.Client{Timeout: 60 * time.Second},
		previewService: NewImagePreviewService(),
		ossService:     NewOSSService(),
	}, nil
}

func (s *SceneCoverService) GenerateAndAttach(sceneID int64) (*models.Scene, error) {
	scene, err := s.sceneRepo.FindByID(sceneID)
	if err != nil {
		return nil, err
	}
	if scene == nil {
		return nil, fmt.Errorf("scene not found")
	}

	storyboards, err := s.storyboardRepo.FindBySceneID(sceneID)
	if err != nil {
		return nil, err
	}

	prompt := buildSceneCoverPrompt(scene, storyboards)
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(config.GlobalConfig.WanxRequestTimeoutSeconds)*time.Second)
	defer cancel()

	imageURL, err := s.wanxClient.GenerateImage(ctx, prompt)
	if err != nil {
		return nil, err
	}

	publicPath, localPath, err := s.downloadAndStore(ctx, scene.ID, imageURL)
	if err != nil {
		return nil, err
	}
	if s.ossService.IsEnabled() {
		defer os.Remove(localPath)
	}

	previewFilename := strings.TrimSuffix(filepath.Base(localPath), filepath.Ext(localPath)) + ".thumb.webp"
	previewPath, err := s.previewService.CreatePreviewFromLocalPath(localPath, "scene-covers", previewFilename, StoryboardPreviewSpec())
	if err != nil {
		return nil, err
	}

	scene.CoverURL = publicPath
	scene.CoverPreviewURL = previewPath
	if err := s.sceneRepo.Update(scene); err != nil {
		return nil, err
	}

	return s.sceneRepo.FindByID(scene.ID)
}

func BuildSceneCoverPrompt(scene *models.Scene, storyboards []models.Storyboard) string {
	return buildSceneCoverPrompt(scene, storyboards)
}

func buildSceneCoverPrompt(scene *models.Scene, storyboards []models.Storyboard) string {
	var b strings.Builder
	b.WriteString("为漫画场景生成一张代表性横版封面图。")
	if scene.Title != "" {
		b.WriteString(" 场景标题：")
		b.WriteString(scene.Title)
		b.WriteString("。")
	}
	if scene.Location != "" {
		b.WriteString(" 地点：")
		b.WriteString(scene.Location)
		b.WriteString("。")
	}
	if scene.TimeOfDay != "" {
		b.WriteString(" 时间：")
		b.WriteString(scene.TimeOfDay)
		b.WriteString("。")
	}
	if scene.Description != "" {
		b.WriteString(" 场景描述：")
		b.WriteString(sanitizePromptText(scene.Description))
		b.WriteString("。")
	}

	backgrounds := make([]string, 0, 3)
	characters := make([]string, 0, 5)
	moods := make([]string, 0, 4)
	contentSummaries := make([]string, 0, 4)
	backgroundSeen := map[string]struct{}{}
	characterSeen := map[string]struct{}{}
	moodSeen := map[string]struct{}{}

	for _, storyboard := range storyboards {
		if len(contentSummaries) < 4 && strings.TrimSpace(storyboard.Content) != "" {
			summary := strings.TrimSpace(storyboard.Content)
			if storyboard.ShotType != "" {
				summary = storyboard.ShotType + "：" + summary
			}
			contentSummaries = append(contentSummaries, sanitizePromptText(summary))
		}
		if bg := strings.TrimSpace(storyboard.Background); bg != "" {
			if _, ok := backgroundSeen[bg]; !ok && len(backgrounds) < 3 {
				backgroundSeen[bg] = struct{}{}
				backgrounds = append(backgrounds, bg)
			}
		}
		if mood := strings.TrimSpace(storyboard.Mood); mood != "" {
			if _, ok := moodSeen[mood]; !ok && len(moods) < 4 {
				moodSeen[mood] = struct{}{}
				moods = append(moods, mood)
			}
		}
		for _, name := range storyboard.CharacterNames {
			name = strings.TrimSpace(name)
			if name == "" {
				continue
			}
			if _, ok := characterSeen[name]; ok || len(characters) >= 5 {
				continue
			}
			characterSeen[name] = struct{}{}
			characters = append(characters, name)
		}
		if len(characters) < 5 {
			for _, character := range storyboard.Characters {
				name := strings.TrimSpace(character.Name)
				if name == "" {
					continue
				}
				if _, ok := characterSeen[name]; ok || len(characters) >= 5 {
					continue
				}
				characterSeen[name] = struct{}{}
				characters = append(characters, name)
			}
		}
	}

	if len(backgrounds) > 0 {
		b.WriteString(" 背景环境：")
		b.WriteString(strings.Join(backgrounds, "；"))
		b.WriteString("。")
	}
	if len(characters) > 0 {
		b.WriteString(" 主要人物：")
		b.WriteString(strings.Join(characters, "、"))
		b.WriteString("。")
	}
	if len(moods) > 0 {
		b.WriteString(" 主要情绪：")
		b.WriteString(strings.Join(moods, "、"))
		b.WriteString("。")
	}
	if len(contentSummaries) > 0 {
		b.WriteString(" 关键镜头摘要：")
		b.WriteString(strings.Join(contentSummaries, "；"))
		b.WriteString("。")
	}

	b.WriteString(" 画面要求：只生成一张完整的单幅场景代表图，不要拼贴，不要多画格，不要把多个镜头机械并排。")
	b.WriteString(" 风格要求：写实电影感、叙事性强、构图克制、光影自然、适合作为场景树封面。")
	b.WriteString(" 输出要求：横版16比9，主体明确，避免文字、水印、logo、字幕、海报排版。")
	return b.String()
}

func (s *SceneCoverService) downloadAndStore(ctx context.Context, sceneID int64, sourceURL string) (string, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return "", "", err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("下载场景封面失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", fmt.Errorf("下载场景封面失败: HTTP %d", resp.StatusCode)
	}

	filename := fmt.Sprintf("scene-%d-%d%s", sceneID, time.Now().Unix(), inferSceneImageExtension(sourceURL))
	publicPath := GeneratedPublicPath("scene-covers", filename)

	if s.ossService.IsEnabled() {
		tmp, err := os.CreateTemp("", "scene-cover-*"+filepath.Ext(filename))
		if err != nil {
			return "", "", fmt.Errorf("创建场景封面临时文件失败: %w", err)
		}
		if _, err := io.Copy(tmp, resp.Body); err != nil {
			_ = tmp.Close()
			return "", "", fmt.Errorf("保存场景封面失败: %w", err)
		}
		if err := tmp.Close(); err != nil {
			return "", "", err
		}
		if err := s.ossService.EnsureUploaded(tmp.Name(), publicPath); err != nil {
			return "", "", fmt.Errorf("上传场景封面到 OSS 失败: %w", err)
		}
		return publicPath, tmp.Name(), nil
	}

	assetRoot := config.GlobalConfig.GeneratedAssetDir
	if !filepath.IsAbs(assetRoot) {
		assetRoot, err = filepath.Abs(filepath.Join(".", assetRoot))
		if err != nil {
			return "", "", err
		}
	}
	coversDir := filepath.Join(assetRoot, "scene-covers")
	if err := os.MkdirAll(coversDir, 0o755); err != nil {
		return "", "", fmt.Errorf("创建场景封面目录失败: %w", err)
	}

	dstPath := filepath.Join(coversDir, filename)
	file, err := os.Create(dstPath)
	if err != nil {
		return "", "", fmt.Errorf("创建场景封面文件失败: %w", err)
	}
	defer file.Close()

	if _, err := io.Copy(file, resp.Body); err != nil {
		return "", "", fmt.Errorf("保存场景封面失败: %w", err)
	}

	return publicPath, dstPath, nil
}

func inferSceneImageExtension(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return ".png"
	}
	ext := strings.ToLower(filepath.Ext(parsed.Path))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp":
		return ext
	default:
		return ".png"
	}
}
