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
)

type GeneratedImageService struct {
	httpClient     *http.Client
	previewService *ImagePreviewService
}

func NewGeneratedImageService() *GeneratedImageService {
	return &GeneratedImageService{
		httpClient:     &http.Client{Timeout: 60 * time.Second},
		previewService: NewImagePreviewService(),
	}
}

func (s *GeneratedImageService) DownloadAndStore(ctx context.Context, sourceURL, subdir, filenameBase string, spec PreviewSpec) (string, string, error) {
	if strings.TrimSpace(sourceURL) == "" {
		return "", "", fmt.Errorf("生成图片 URL 为空")
	}

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
	outputDir := filepath.Join(assetRoot, subdir)
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		return "", "", fmt.Errorf("创建图片目录失败: %w", err)
	}

	filename := fmt.Sprintf("%s-%d%s", filenameBase, time.Now().Unix(), inferGeneratedImageExtension(sourceURL))
	localPath := filepath.Join(outputDir, filename)
	file, err := os.Create(localPath)
	if err != nil {
		return "", "", fmt.Errorf("创建图片文件失败: %w", err)
	}
	defer file.Close()

	if _, err := io.Copy(file, resp.Body); err != nil {
		return "", "", fmt.Errorf("保存图片文件失败: %w", err)
	}

	previewFilename := strings.TrimSuffix(filename, filepath.Ext(filename)) + ".thumb.webp"
	previewPath, err := s.previewService.CreatePreviewFromLocalPath(localPath, subdir, previewFilename, spec)
	if err != nil {
		return "", "", err
	}

	basePath := strings.TrimRight(config.GlobalConfig.GeneratedAssetBasePath, "/")
	return fmt.Sprintf("%s/%s/%s", basePath, strings.Trim(subdir, "/"), filename), previewPath, nil
}

func inferGeneratedImageExtension(rawURL string) string {
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
