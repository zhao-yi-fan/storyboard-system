package services

import (
	"context"
	"encoding/json"
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
	historyRepo    *repository.StoryboardMediaGenerationRepository
	wanxClient     *WanxClient
	httpClient     *http.Client
	previewService *ImagePreviewService
}

func NewStoryboardCoverService() (*StoryboardCoverService, error) {
	wanxClient, err := NewWanxClient()
	if err != nil {
		return nil, err
	}

	return &StoryboardCoverService{
		storyboardRepo: &repository.StoryboardRepository{},
		sceneRepo:      &repository.SceneRepository{},
		historyRepo:    &repository.StoryboardMediaGenerationRepository{},
		wanxClient:     wanxClient,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
		previewService: NewImagePreviewService(),
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

	generation := &models.StoryboardMediaGeneration{
		StoryboardID: storyboard.ID,
		MediaType:    "cover",
		Model:        config.GlobalConfig.WanxModel,
		Status:       "generating",
		MetaJSON:     mustMarshalMediaMeta(map[string]any{"resolution": "1024x576", "preview_format": "webp", "preview_width": 480}),
	}
	if err := s.historyRepo.Create(generation); err != nil {
		return nil, err
	}

	prompt := buildStoryboardCoverPrompt(storyboard, scene)
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(config.GlobalConfig.WanxRequestTimeoutSeconds)*time.Second)
	defer cancel()

	imageURL, err := s.wanxClient.GenerateImage(ctx, prompt)
	if err != nil {
		s.markGenerationFailed(generation, err)
		return nil, err
	}

	publicPath, localPath, err := s.downloadAndStore(ctx, storyboard.ID, imageURL)
	if err != nil {
		s.markGenerationFailed(generation, err)
		return nil, err
	}

	previewFilename := strings.TrimSuffix(filepath.Base(localPath), filepath.Ext(localPath)) + ".thumb.webp"
	previewPath, err := s.previewService.CreatePreviewFromLocalPath(localPath, "covers", previewFilename, StoryboardPreviewSpec())
	if err != nil {
		s.markGenerationFailed(generation, err)
		return nil, err
	}

	storyboard.ThumbnailURL = publicPath
	storyboard.ThumbnailPreviewURL = previewPath
	if err := s.storyboardRepo.Update(storyboard); err != nil {
		s.markGenerationFailed(generation, err)
		return nil, err
	}

	generation.Status = "succeeded"
	generation.ResultURL = publicPath
	generation.PreviewURL = previewPath
	generation.ErrorMessage = ""
	if err := s.historyRepo.Update(generation); err != nil {
		return nil, err
	}
	if err := s.historyRepo.MarkCurrent(storyboard.ID, generation.MediaType, generation.ID); err != nil {
		return nil, err
	}

	return s.storyboardRepo.FindByID(storyboard.ID)
}

func (s *StoryboardCoverService) markGenerationFailed(generation *models.StoryboardMediaGeneration, generationErr error) {
	if generation == nil {
		return
	}
	generation.Status = "failed"
	generation.ErrorMessage = generationErr.Error()
	_ = s.historyRepo.Update(generation)
}

func buildStoryboardCoverPrompt(storyboard *models.Storyboard, scene *models.Scene) string {
	var b strings.Builder
	b.WriteString("为漫画分镜生成一张单镜头关键帧封面图。")
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

	b.WriteString(" 画面要求：只生成一个明确主体的单帧镜头，不要拼贴，不要多角色重复，不要多画格，不要分镜条。")
	b.WriteString(" 风格要求：写实电影感、叙事性强、构图清晰、景深自然、光影克制、适合用作分镜封面。")
	b.WriteString(" 输出要求：横版16比9，主体突出，避免文字、水印、边框、logo、字幕、海报排版。")
	return b.String()
}

func sanitizePromptText(input string) string {
	replacer := strings.NewReplacer("\n", "；", "\r", "", "\t", " ")
	return replacer.Replace(strings.TrimSpace(input))
}

func (s *StoryboardCoverService) downloadAndStore(ctx context.Context, storyboardID int64, sourceURL string) (string, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return "", "", err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("下载生成图片失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", fmt.Errorf("下载生成图片失败: HTTP %d", resp.StatusCode)
	}

	assetRoot := config.GlobalConfig.GeneratedAssetDir
	if !filepath.IsAbs(assetRoot) {
		assetRoot, err = filepath.Abs(filepath.Join(".", assetRoot))
		if err != nil {
			return "", "", err
		}
	}
	coversDir := filepath.Join(assetRoot, "covers")
	if err := os.MkdirAll(coversDir, 0o755); err != nil {
		return "", "", fmt.Errorf("创建封面目录失败: %w", err)
	}

	filename := fmt.Sprintf("storyboard-%d-%d%s", storyboardID, time.Now().Unix(), inferImageExtension(sourceURL))
	dstPath := filepath.Join(coversDir, filename)
	file, err := os.Create(dstPath)
	if err != nil {
		return "", "", fmt.Errorf("创建封面文件失败: %w", err)
	}
	defer file.Close()

	if _, err := io.Copy(file, resp.Body); err != nil {
		return "", "", fmt.Errorf("保存封面文件失败: %w", err)
	}

	basePath := strings.TrimRight(config.GlobalConfig.GeneratedAssetBasePath, "/")
	return fmt.Sprintf("%s/covers/%s", basePath, filename), dstPath, nil
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

func mustMarshalMediaMeta(value map[string]any) string {
	if len(value) == 0 {
		return ""
	}
	data, err := json.Marshal(value)
	if err != nil {
		return ""
	}
	return string(data)
}
