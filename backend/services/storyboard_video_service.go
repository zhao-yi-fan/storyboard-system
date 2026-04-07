package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"image"
	"image/jpeg"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"storyboard-backend/config"
	"storyboard-backend/models"
	"storyboard-backend/repository"

	_ "image/jpeg"
	_ "image/png"
)

type StoryboardVideoService struct {
	storyboardRepo *repository.StoryboardRepository
	sceneRepo      *repository.SceneRepository
	historyRepo    *repository.StoryboardMediaGenerationRepository
	coverService   *StoryboardCoverService
	videoClient    *WanxVideoClient
	httpClient     *http.Client
}

const storyboardVideoPreviewHeight = 480

func NewStoryboardVideoService() (*StoryboardVideoService, error) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		return nil, fmt.Errorf("镜头视频预览未配置：缺少 ffmpeg")
	}

	coverService, err := NewStoryboardCoverService()
	if err != nil {
		return nil, err
	}
	videoClient, err := NewWanxVideoClient()
	if err != nil {
		return nil, err
	}

	return &StoryboardVideoService{
		storyboardRepo: &repository.StoryboardRepository{},
		sceneRepo:      &repository.SceneRepository{},
		historyRepo:    &repository.StoryboardMediaGenerationRepository{},
		coverService:   coverService,
		videoClient:    videoClient,
		httpClient: &http.Client{
			Timeout: 90 * time.Second,
		},
	}, nil
}

func (s *StoryboardVideoService) GenerateAndAttach(storyboardID int64, publicBaseURL string, generation *models.StoryboardMediaGeneration) (*models.Storyboard, error) {
	storyboard, err := s.storyboardRepo.FindByID(storyboardID)
	if err != nil {
		s.markGenerationFailed(generation, err)
		return nil, err
	}
	if storyboard == nil {
		err := fmt.Errorf("storyboard not found")
		s.markGenerationFailed(generation, err)
		return nil, err
	}

	scene, err := s.sceneRepo.FindByID(storyboard.SceneID)
	if err != nil {
		s.markGenerationFailed(generation, err)
		return nil, err
	}
	if scene == nil {
		err := fmt.Errorf("scene not found")
		s.markGenerationFailed(generation, err)
		return nil, err
	}

	if strings.TrimSpace(storyboard.ThumbnailURL) == "" {
		storyboard, err = s.coverService.GenerateAndAttach(storyboardID)
		if err != nil {
			s.markGenerationFailed(generation, err)
			return nil, err
		}
	}

	imageInput, err := s.resolveImageInput(publicBaseURL, storyboard.ThumbnailURL)
	if err != nil {
		s.markGenerationFailed(generation, err)
		return nil, err
	}
	if imageInput == "" {
		err := fmt.Errorf("镜头封面图不可用，无法生成视频")
		s.markGenerationFailed(generation, err)
		return nil, err
	}

	storyboard.VideoStatus = "generating"
	storyboard.VideoError = ""
	if err := s.storyboardRepo.Update(storyboard); err != nil {
		s.markGenerationFailed(generation, err)
		return nil, err
	}

	if generation != nil {
		generation.SourceURL = storyboard.ThumbnailURL
		generation.PreviewURL = ""
		generation.MetaJSON = mustMarshalMediaMeta(map[string]any{
			"resolution": "720P",
			"duration":   5,
			"audio":      true,
		})
		if err := s.historyRepo.Update(generation); err != nil {
			return nil, err
		}
	}

	prompt := buildStoryboardVideoPrompt(storyboard, scene)
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(config.GlobalConfig.WanxVideoRequestTimeoutSeconds)*time.Second)
	defer cancel()

	videoURL, duration, err := s.videoClient.GenerateVideo(ctx, prompt, imageInput, generation.Model)
	if err != nil {
		storyboard.VideoStatus = "failed"
		storyboard.VideoError = err.Error()
		_ = s.storyboardRepo.Update(storyboard)
		s.markGenerationFailed(generation, err)
		return nil, err
	}

	publicPath, previewPath, err := s.downloadAndStore(ctx, storyboard.ID, videoURL)
	if err != nil {
		storyboard.VideoStatus = "failed"
		storyboard.VideoError = err.Error()
		_ = s.storyboardRepo.Update(storyboard)
		s.markGenerationFailed(generation, err)
		return nil, err
	}

	storyboard.VideoURL = publicPath
	storyboard.VideoPreviewURL = previewPath
	storyboard.VideoStatus = "succeeded"
	storyboard.VideoError = ""
	storyboard.VideoDuration = duration
	if err := s.storyboardRepo.Update(storyboard); err != nil {
		s.markGenerationFailed(generation, err)
		return nil, err
	}

	if generation != nil {
		generation.Status = "succeeded"
		generation.ResultURL = publicPath
		generation.PreviewURL = previewPath
		generation.SourceURL = storyboard.ThumbnailURL
		generation.ErrorMessage = ""
		generation.MetaJSON = mustMarshalMediaMeta(map[string]any{
			"resolution": "720P",
			"duration":   duration,
			"audio":      true,
			"preview_height": storyboardVideoPreviewHeight,
		})
		if err := s.historyRepo.Update(generation); err != nil {
			return nil, err
		}
		if err := s.historyRepo.MarkCurrent(storyboard.ID, generation.MediaType, generation.ID); err != nil {
			return nil, err
		}
	}

	return s.storyboardRepo.FindByID(storyboard.ID)
}

func (s *StoryboardVideoService) StartGenerate(storyboardID int64, publicBaseURL, model string) (*models.Storyboard, error) {
	storyboard, err := s.storyboardRepo.FindByID(storyboardID)
	if err != nil {
		return nil, err
	}
	if storyboard == nil {
		return nil, fmt.Errorf("storyboard not found")
	}

	if strings.TrimSpace(model) == "" {
		model = config.GlobalConfig.WanxVideoModel
	}

	if storyboard.VideoStatus == "generating" {
		return storyboard, nil
	}

	generation := &models.StoryboardMediaGeneration{
		StoryboardID: storyboard.ID,
		MediaType:    "video",
		Model:        model,
		Status:       "generating",
		PreviewURL:   "",
		SourceURL:    storyboard.ThumbnailURL,
		MetaJSON:     mustMarshalMediaMeta(map[string]any{"resolution": "720P", "duration": 5, "audio": true, "preview_height": storyboardVideoPreviewHeight}),
	}
	if err := s.historyRepo.Create(generation); err != nil {
		return nil, err
	}

	storyboard.VideoStatus = "generating"
	storyboard.VideoError = ""
	if err := s.storyboardRepo.Update(storyboard); err != nil {
		s.markGenerationFailed(generation, err)
		return nil, err
	}

	go func(gen models.StoryboardMediaGeneration) {
		if _, err := s.GenerateAndAttach(storyboardID, publicBaseURL, &gen); err != nil {
			latest, findErr := s.storyboardRepo.FindByID(storyboardID)
			if findErr == nil && latest != nil {
				latest.VideoStatus = "failed"
				latest.VideoError = err.Error()
				_ = s.storyboardRepo.Update(latest)
			}
		}
	}(*generation)

	return s.storyboardRepo.FindByID(storyboardID)
}

func (s *StoryboardVideoService) markGenerationFailed(generation *models.StoryboardMediaGeneration, generationErr error) {
	if generation == nil {
		return
	}
	generation.Status = "failed"
	generation.ErrorMessage = generationErr.Error()
	_ = s.historyRepo.Update(generation)
}

func buildStoryboardVideoPrompt(storyboard *models.Storyboard, scene *models.Scene) string {
	var b strings.Builder
	b.WriteString("基于输入首帧图像生成一个5秒的单镜头电影分镜视频。")
	if scene.Title != "" {
		b.WriteString(" 场景：")
		b.WriteString(scene.Title)
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
			name := strings.TrimSpace(character.Name)
			if name != "" {
				characters = append(characters, name)
			}
		}
	}
	if len(characters) > 0 {
		b.WriteString(" 主要人物：")
		b.WriteString(strings.Join(characters, "、"))
		b.WriteString("。")
	}

	if storyboard.Content != "" {
		b.WriteString(" 画面动作：")
		b.WriteString(storyboard.Content)
		b.WriteString("。")
	}
	if storyboard.CameraDirection != "" {
		b.WriteString(" 镜头机位：")
		b.WriteString(storyboard.CameraDirection)
		b.WriteString("。")
	}
	if storyboard.Notes != "" {
		b.WriteString(" 情绪与细节：")
		b.WriteString(sanitizePromptText(storyboard.Notes))
		b.WriteString("。")
	}

	b.WriteString(" 保持首帧构图和主体一致，只生成单镜头连续动作，不切镜，不闪回。")
	b.WriteString(" 风格：写实电影感、自然运动、光影克制、镜头稳定。")
	b.WriteString(" 音频：根据场景自动生成环境音和氛围声，不要旁白，不要字幕，不要水印。")
	return b.String()
}

func absolutizeGeneratedURL(publicBaseURL, path string) string {
	path = strings.TrimSpace(path)
	if path == "" {
		return ""
	}
	if strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") {
		return path
	}
	base := strings.TrimRight(strings.TrimSpace(publicBaseURL), "/")
	if base == "" {
		return path
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return base + path
}

func (s *StoryboardVideoService) resolveImageInput(publicBaseURL, thumbnailURL string) (string, error) {
	thumbnailURL = strings.TrimSpace(thumbnailURL)
	if thumbnailURL == "" {
		return "", nil
	}

	if absolute := absolutizeGeneratedURL(publicBaseURL, thumbnailURL); strings.HasPrefix(absolute, "http://") || strings.HasPrefix(absolute, "https://") {
		return absolute, nil
	}

	if strings.HasPrefix(thumbnailURL, "/generated/") {
		localPath, err := generatedURLToLocalPath(thumbnailURL)
		if err == nil {
			dataURL, err := prepareVideoInputDataURL(localPath)
			if err == nil {
				return dataURL, nil
			}
			dataURL, err = fileToDataURL(localPath)
			if err == nil {
				return dataURL, nil
			}
		}
	}

	return absolutizeGeneratedURL(publicBaseURL, thumbnailURL), nil
}

func generatedURLToLocalPath(resourcePath string) (string, error) {
	assetRoot := config.GlobalConfig.GeneratedAssetDir
	if !filepath.IsAbs(assetRoot) {
		var err error
		assetRoot, err = filepath.Abs(filepath.Join(".", assetRoot))
		if err != nil {
			return "", err
		}
	}

	basePath := strings.TrimRight(config.GlobalConfig.GeneratedAssetBasePath, "/")
	if !strings.HasPrefix(resourcePath, basePath+"/") {
		return "", fmt.Errorf("not a generated local asset")
	}

	relative := strings.TrimPrefix(resourcePath, basePath+"/")
	return filepath.Join(assetRoot, filepath.FromSlash(relative)), nil
}

func fileToDataURL(path string) (string, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}

	mimeType := mimeTypeFromPath(path)
	encoded := base64.StdEncoding.EncodeToString(raw)
	return "data:" + mimeType + ";base64," + encoded, nil
}

func prepareVideoInputDataURL(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()

	src, _, err := image.Decode(file)
	if err != nil {
		return "", err
	}

	cropped := centerCropToAspect(src, 16, 9)
	resized := resizeNearest(cropped, 1280, 720)

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, resized, &jpeg.Options{Quality: 85}); err != nil {
		return "", err
	}

	return "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(buf.Bytes()), nil
}

func centerCropToAspect(src image.Image, aspectW, aspectH int) image.Image {
	b := src.Bounds()
	srcW := b.Dx()
	srcH := b.Dy()
	if srcW <= 0 || srcH <= 0 {
		return src
	}

	targetRatio := float64(aspectW) / float64(aspectH)
	srcRatio := float64(srcW) / float64(srcH)

	if srcRatio > targetRatio {
		cropW := int(float64(srcH) * targetRatio)
		x0 := b.Min.X + (srcW-cropW)/2
		return cropImage(src, image.Rect(x0, b.Min.Y, x0+cropW, b.Max.Y))
	}

	cropH := int(float64(srcW) / targetRatio)
	y0 := b.Min.Y + (srcH-cropH)/2
	return cropImage(src, image.Rect(b.Min.X, y0, b.Max.X, y0+cropH))
}

func cropImage(src image.Image, rect image.Rectangle) image.Image {
	dst := image.NewRGBA(image.Rect(0, 0, rect.Dx(), rect.Dy()))
	for y := 0; y < rect.Dy(); y++ {
		for x := 0; x < rect.Dx(); x++ {
			dst.Set(x, y, src.At(rect.Min.X+x, rect.Min.Y+y))
		}
	}
	return dst
}

func resizeNearest(src image.Image, width, height int) image.Image {
	dst := image.NewRGBA(image.Rect(0, 0, width, height))
	srcBounds := src.Bounds()
	srcW := srcBounds.Dx()
	srcH := srcBounds.Dy()
	if srcW == 0 || srcH == 0 {
		return dst
	}

	for y := 0; y < height; y++ {
		sy := srcBounds.Min.Y + y*srcH/height
		for x := 0; x < width; x++ {
			sx := srcBounds.Min.X + x*srcW/width
			dst.Set(x, y, src.At(sx, sy))
		}
	}
	return dst
}

func (s *StoryboardVideoService) downloadAndStore(ctx context.Context, storyboardID int64, sourceURL string) (string, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return "", "", err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("下载生成视频失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", fmt.Errorf("下载生成视频失败: HTTP %d", resp.StatusCode)
	}

	assetRoot := config.GlobalConfig.GeneratedAssetDir
	if !filepath.IsAbs(assetRoot) {
		assetRoot, err = filepath.Abs(filepath.Join(".", assetRoot))
		if err != nil {
			return "", "", err
		}
	}
	videosDir := filepath.Join(assetRoot, "videos")
	if err := os.MkdirAll(videosDir, 0o755); err != nil {
		return "", "", fmt.Errorf("创建视频目录失败: %w", err)
	}

	filename := fmt.Sprintf("storyboard-%d-%d.mp4", storyboardID, time.Now().Unix())
	dstPath := filepath.Join(videosDir, filename)
	file, err := os.Create(dstPath)
	if err != nil {
		return "", "", fmt.Errorf("创建视频文件失败: %w", err)
	}
	defer file.Close()

	if _, err := io.Copy(file, resp.Body); err != nil {
		return "", "", fmt.Errorf("保存视频文件失败: %w", err)
	}

	previewFilename := strings.TrimSuffix(filename, ".mp4") + ".preview.mp4"
	previewPath := filepath.Join(videosDir, previewFilename)
	if err := generateVideoPreview(ctx, dstPath, previewPath); err != nil {
		return "", "", err
	}

	basePath := strings.TrimRight(config.GlobalConfig.GeneratedAssetBasePath, "/")
	return fmt.Sprintf("%s/videos/%s", basePath, filename), fmt.Sprintf("%s/videos/%s", basePath, previewFilename), nil
}

func generateVideoPreview(ctx context.Context, srcPath, previewPath string) error {
	cmd := exec.CommandContext(
		ctx,
		"ffmpeg",
		"-y",
		"-i", srcPath,
		"-vf", fmt.Sprintf("scale=-2:%d", storyboardVideoPreviewHeight),
		"-c:v", "libx264",
		"-preset", "veryfast",
		"-crf", "32",
		"-c:a", "aac",
		"-b:a", "96k",
		"-movflags", "+faststart",
		previewPath,
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("生成视频预览失败: %v: %s", err, strings.TrimSpace(string(output)))
	}
	return nil
}

func mimeTypeFromPath(path string) string {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	default:
		return "image/png"
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
