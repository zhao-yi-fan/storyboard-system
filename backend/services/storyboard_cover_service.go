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

type StoryboardCoverService struct {
	storyboardRepo *repository.StoryboardRepository
	sceneRepo      *repository.SceneRepository
	wanxClient     *WanxClient
	httpClient     *http.Client
}

func NewStoryboardCoverService() (*StoryboardCoverService, error) {
	wanxClient, err := NewWanxClient()
	if err != nil {
		return nil, err
	}

	return &StoryboardCoverService{
		storyboardRepo: &repository.StoryboardRepository{},
		sceneRepo:      &repository.SceneRepository{},
		wanxClient:     wanxClient,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}, nil
}

func (s *StoryboardCoverService) GenerateAndAttach(storyboardID int64) (*models.Storyboard, error) {
	storyboard, err := s.storyboardRepo.FindByID(storyboardID)
	if err != nil {
		return nil, err
	}
	if storyboard == nil {
		return nil, fmt.Errorf("storyboard not found")
	}

	scene, err := s.sceneRepo.FindByID(storyboard.SceneID)
	if err != nil {
		return nil, err
	}
	if scene == nil {
		return nil, fmt.Errorf("scene not found")
	}

	prompt := buildStoryboardCoverPrompt(storyboard, scene)
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(config.GlobalConfig.WanxRequestTimeoutSeconds)*time.Second)
	defer cancel()

	imageURL, err := s.wanxClient.GenerateImage(ctx, prompt)
	if err != nil {
		return nil, err
	}

	publicPath, err := s.downloadAndStore(ctx, storyboard.ID, imageURL)
	if err != nil {
		return nil, err
	}

	storyboard.ThumbnailURL = publicPath
	if err := s.storyboardRepo.Update(storyboard); err != nil {
		return nil, err
	}

	return s.storyboardRepo.FindByID(storyboard.ID)
}

func buildStoryboardCoverPrompt(storyboard *models.Storyboard, scene *models.Scene) string {
	var b strings.Builder
	b.WriteString("为漫画分镜生成一张高质量电影感封面图。")
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
	if storyboard.Background != "" {
		b.WriteString(" 背景环境：")
		b.WriteString(storyboard.Background)
		b.WriteString("。")
	}

	characters := storyboard.CharacterNames
	if len(characters) == 0 && len(storyboard.Characters) > 0 {
		for _, character := range storyboard.Characters {
			if strings.TrimSpace(character.Name) != "" {
				characters = append(characters, character.Name)
			}
		}
	}
	if len(characters) > 0 {
		b.WriteString(" 出镜人物：")
		b.WriteString(strings.Join(characters, "、"))
		b.WriteString("。")
	}

	if storyboard.Content != "" {
		b.WriteString(" 画面主体：")
		b.WriteString(storyboard.Content)
		b.WriteString("。")
	}
	if storyboard.CameraDirection != "" {
		b.WriteString(" 机位：")
		b.WriteString(storyboard.CameraDirection)
		b.WriteString("。")
	}
	if storyboard.Notes != "" {
		b.WriteString(" 额外提示：")
		b.WriteString(sanitizePromptText(storyboard.Notes))
		b.WriteString("。")
	}

	b.WriteString(" 风格要求：写实电影感、构图清晰、适合用作分镜封面、细节丰富、光影自然。不要文字，不要水印，不要多宫格。")
	return b.String()
}

func sanitizePromptText(input string) string {
	replacer := strings.NewReplacer("\n", "；", "\r", "", "\t", " ")
	return replacer.Replace(strings.TrimSpace(input))
}

func (s *StoryboardCoverService) downloadAndStore(ctx context.Context, storyboardID int64, sourceURL string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return "", err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("下载生成图片失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("下载生成图片失败: HTTP %d", resp.StatusCode)
	}

	assetRoot := config.GlobalConfig.GeneratedAssetDir
	if !filepath.IsAbs(assetRoot) {
		assetRoot, err = filepath.Abs(filepath.Join(".", assetRoot))
		if err != nil {
			return "", err
		}
	}
	coversDir := filepath.Join(assetRoot, "covers")
	if err := os.MkdirAll(coversDir, 0o755); err != nil {
		return "", fmt.Errorf("创建封面目录失败: %w", err)
	}

	filename := fmt.Sprintf("storyboard-%d-%d%s", storyboardID, time.Now().Unix(), inferImageExtension(sourceURL))
	dstPath := filepath.Join(coversDir, filename)
	file, err := os.Create(dstPath)
	if err != nil {
		return "", fmt.Errorf("创建封面文件失败: %w", err)
	}
	defer file.Close()

	if _, err := io.Copy(file, resp.Body); err != nil {
		return "", fmt.Errorf("保存封面文件失败: %w", err)
	}

	basePath := strings.TrimRight(config.GlobalConfig.GeneratedAssetBasePath, "/")
	return fmt.Sprintf("%s/covers/%s", basePath, filename), nil
}

func inferImageExtension(rawURL string) string {
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
