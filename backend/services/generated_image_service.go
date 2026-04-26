package services

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type GeneratedImageService struct {
	httpClient     *http.Client
	previewService *ImagePreviewService
	ossService     *OSSService
}

func NewGeneratedImageService() *GeneratedImageService {
	return &GeneratedImageService{
		httpClient:     &http.Client{Timeout: 60 * time.Second},
		previewService: NewImagePreviewService(),
		ossService:     NewOSSService(),
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

	return s.storeReader(resp.Body, subdir, filenameBase, inferGeneratedImageExtension(sourceURL), spec)
}

func (s *GeneratedImageService) StoreBytes(data []byte, subdir, filenameBase, ext string, spec PreviewSpec) (string, string, error) {
	if len(data) == 0 {
		return "", "", fmt.Errorf("生成图片内容为空")
	}
	return s.storeReader(bytes.NewReader(data), subdir, filenameBase, normalizeGeneratedImageExtension(ext), spec)
}

func (s *GeneratedImageService) storeReader(reader io.Reader, subdir, filenameBase, ext string, spec PreviewSpec) (string, string, error) {
	filename := fmt.Sprintf("%s-%d%s", filenameBase, time.Now().Unix(), normalizeGeneratedImageExtension(ext))
	publicPath := GeneratedPublicPath(subdir, filename)

	if s.ossService.IsEnabled() {
		tmp, err := os.CreateTemp("", "storyboard-generated-*"+filepath.Ext(filename))
		if err != nil {
			return "", "", fmt.Errorf("创建图片临时文件失败: %w", err)
		}
		tmpPath := tmp.Name()
		defer os.Remove(tmpPath)

		if _, err := io.Copy(tmp, reader); err != nil {
			_ = tmp.Close()
			return "", "", fmt.Errorf("保存图片文件失败: %w", err)
		}
		if err := tmp.Close(); err != nil {
			return "", "", err
		}
		if err := s.ossService.EnsureUploaded(tmpPath, publicPath); err != nil {
			return "", "", fmt.Errorf("上传图片到 OSS 失败: %w", err)
		}
		previewFilename := strings.TrimSuffix(filename, filepath.Ext(filename)) + ".thumb.webp"
		previewPath, err := s.previewService.CreatePreviewFromLocalPath(tmpPath, subdir, previewFilename, spec)
		if err != nil {
			return "", "", err
		}
		return publicPath, previewPath, nil
	}

	assetRoot, err := resolveGeneratedAssetRoot()
	if err != nil {
		return "", "", err
	}
	outputDir := filepath.Join(assetRoot, subdir)
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		return "", "", fmt.Errorf("创建图片目录失败: %w", err)
	}

	localPath := filepath.Join(outputDir, filename)
	file, err := os.Create(localPath)
	if err != nil {
		return "", "", fmt.Errorf("创建图片文件失败: %w", err)
	}
	defer file.Close()

	if _, err := io.Copy(file, reader); err != nil {
		return "", "", fmt.Errorf("保存图片文件失败: %w", err)
	}

	previewFilename := strings.TrimSuffix(filename, filepath.Ext(filename)) + ".thumb.webp"
	previewPath, err := s.previewService.CreatePreviewFromLocalPath(localPath, subdir, previewFilename, spec)
	if err != nil {
		return "", "", err
	}

	return publicPath, previewPath, nil
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

func normalizeGeneratedImageExtension(ext string) string {
	ext = strings.ToLower(strings.TrimSpace(ext))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp":
		return ext
	default:
		return ".png"
	}
}
