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
	"net/url"
	"os"
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
	coverService   *StoryboardCoverService
	videoClient    *WanxVideoClient
	httpClient     *http.Client
}

func NewStoryboardVideoService() (*StoryboardVideoService, error) {
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
		coverService:   coverService,
		videoClient:    videoClient,
		httpClient: &http.Client{
			Timeout: 90 * time.Second,
		},
	}, nil
}

func (s *StoryboardVideoService) GenerateAndAttach(storyboardID int64, publicBaseURL string) (*models.Storyboard, error) {
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

	if strings.TrimSpace(storyboard.ThumbnailURL) == "" {
		storyboard, err = s.coverService.GenerateAndAttach(storyboardID)
		if err != nil {
			return nil, err
		}
	}

	imageInput, err := s.resolveImageInput(publicBaseURL, storyboard.ThumbnailURL)
	if err != nil {
		return nil, err
	}
	if imageInput == "" {
		return nil, fmt.Errorf("镜头封面图不可用，无法生成视频")
	}

	storyboard.VideoStatus = "generating"
	storyboard.VideoError = ""
	if err := s.storyboardRepo.Update(storyboard); err != nil {
		return nil, err
	}

	prompt := buildStoryboardVideoPrompt(storyboard, scene)
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(config.GlobalConfig.WanxVideoRequestTimeoutSeconds)*time.Second)
	defer cancel()

	videoURL, duration, err := s.videoClient.GenerateVideo(ctx, prompt, imageInput)
	if err != nil {
		storyboard.VideoStatus = "failed"
		storyboard.VideoError = err.Error()
		_ = s.storyboardRepo.Update(storyboard)
		return nil, err
	}

	publicPath, err := s.downloadAndStore(ctx, storyboard.ID, videoURL)
	if err != nil {
		storyboard.VideoStatus = "failed"
		storyboard.VideoError = err.Error()
		_ = s.storyboardRepo.Update(storyboard)
		return nil, err
	}

	storyboard.VideoURL = publicPath
	storyboard.VideoStatus = "succeeded"
	storyboard.VideoError = ""
	storyboard.VideoDuration = duration
	if err := s.storyboardRepo.Update(storyboard); err != nil {
		return nil, err
	}

	return s.storyboardRepo.FindByID(storyboard.ID)
}

func (s *StoryboardVideoService) StartGenerate(storyboardID int64, publicBaseURL string) (*models.Storyboard, error) {
	storyboard, err := s.storyboardRepo.FindByID(storyboardID)
	if err != nil {
		return nil, err
	}
	if storyboard == nil {
		return nil, fmt.Errorf("storyboard not found")
	}

	if storyboard.VideoStatus == "generating" {
		return storyboard, nil
	}

	storyboard.VideoStatus = "generating"
	storyboard.VideoError = ""
	if err := s.storyboardRepo.Update(storyboard); err != nil {
		return nil, err
	}

	go func() {
		if _, err := s.GenerateAndAttach(storyboardID, publicBaseURL); err != nil {
			latest, findErr := s.storyboardRepo.FindByID(storyboardID)
			if findErr != nil || latest == nil {
				return
			}
			latest.VideoStatus = "failed"
			latest.VideoError = err.Error()
			_ = s.storyboardRepo.Update(latest)
		}
	}()

	return s.storyboardRepo.FindByID(storyboardID)
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

	if srcRatio < targetRatio {
		cropH := int(float64(srcW) / targetRatio)
		y0 := b.Min.Y + (srcH-cropH)/2
		return cropImage(src, image.Rect(b.Min.X, y0, b.Max.X, y0+cropH))
	}

	return src
}

func cropImage(src image.Image, rect image.Rectangle) *image.RGBA {
	dst := image.NewRGBA(image.Rect(0, 0, rect.Dx(), rect.Dy()))
	for y := 0; y < rect.Dy(); y++ {
		for x := 0; x < rect.Dx(); x++ {
			dst.Set(x, y, src.At(rect.Min.X+x, rect.Min.Y+y))
		}
	}
	return dst
}

func resizeNearest(src image.Image, dstW, dstH int) *image.RGBA {
	dst := image.NewRGBA(image.Rect(0, 0, dstW, dstH))
	srcBounds := src.Bounds()
	srcW := srcBounds.Dx()
	srcH := srcBounds.Dy()
	if srcW <= 0 || srcH <= 0 {
		return dst
	}

	for y := 0; y < dstH; y++ {
		srcY := srcBounds.Min.Y + y*srcH/dstH
		for x := 0; x < dstW; x++ {
			srcX := srcBounds.Min.X + x*srcW/dstW
			dst.Set(x, y, src.At(srcX, srcY))
		}
	}
	return dst
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


func (s *StoryboardVideoService) downloadAndStore(ctx context.Context, storyboardID int64, sourceURL string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return "", err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("下载生成视频失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("下载生成视频失败: HTTP %d", resp.StatusCode)
	}

	assetRoot := config.GlobalConfig.GeneratedAssetDir
	if !filepath.IsAbs(assetRoot) {
		assetRoot, err = filepath.Abs(filepath.Join(".", assetRoot))
		if err != nil {
			return "", err
		}
	}
	videosDir := filepath.Join(assetRoot, "videos")
	if err := os.MkdirAll(videosDir, 0o755); err != nil {
		return "", fmt.Errorf("创建视频目录失败: %w", err)
	}

	filename := fmt.Sprintf("storyboard-%d-%d%s", storyboardID, time.Now().Unix(), inferVideoExtension(sourceURL))
	dstPath := filepath.Join(videosDir, filename)
	file, err := os.Create(dstPath)
	if err != nil {
		return "", fmt.Errorf("创建视频文件失败: %w", err)
	}
	defer file.Close()

	if _, err := io.Copy(file, resp.Body); err != nil {
		return "", fmt.Errorf("保存视频文件失败: %w", err)
	}

	basePath := strings.TrimRight(config.GlobalConfig.GeneratedAssetBasePath, "/")
	return fmt.Sprintf("%s/videos/%s", basePath, filename), nil
}

func inferVideoExtension(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return ".mp4"
	}
	ext := strings.ToLower(filepath.Ext(parsed.Path))
	switch ext {
	case ".mp4", ".mov", ".webm":
		return ext
	default:
		return ".mp4"
	}
}
