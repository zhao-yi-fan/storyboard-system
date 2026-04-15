package services

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"image"
	stddraw "image/draw"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/chai2010/webp"
	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp"

	"storyboard-backend/config"
)

type PreviewSpec struct {
	Width  int
	Height int
	Crop   bool
}

type ImagePreviewService struct {
	httpClient *http.Client
	ossService *OSSService
}

func NewImagePreviewService() *ImagePreviewService {
	return &ImagePreviewService{
		httpClient: &http.Client{Timeout: 90 * time.Second},
		ossService: NewOSSService(),
	}
}

func StoryboardPreviewSpec() PreviewSpec {
	return PreviewSpec{Width: 480, Height: 270, Crop: true}
}

func AssetPreviewSpec() PreviewSpec {
	return PreviewSpec{Width: 480, Height: 270, Crop: true}
}

func AvatarPreviewSpec() PreviewSpec {
	return PreviewSpec{Width: 256, Height: 256, Crop: true}
}

func (s *ImagePreviewService) CreatePreviewFromSource(ctx context.Context, source, subdir, baseName string, spec PreviewSpec) (string, error) {
	if strings.TrimSpace(source) == "" {
		return "", nil
	}

	if localPath, ok := s.resolveSourceToLocalPath(source); ok {
		previewName := derivedPreviewFilename(localPath, baseName)
		return s.CreatePreviewFromLocalPath(localPath, subdir, previewName, spec)
	}

	if s.ossService.IsEnabled() && IsGeneratedAssetPath(source) {
		tmp, cleanup, err := s.copyGeneratedToTempFile(source)
		if err != nil {
			return "", err
		}
		defer cleanup()
		previewName := derivedPreviewFilename(tmp, baseName)
		return s.CreatePreviewFromLocalPath(tmp, subdir, previewName, spec)
	}

	previewName := remotePreviewFilename(source, baseName)
	return s.createPreviewFromRemoteURL(ctx, source, subdir, previewName, spec)
}

func (s *ImagePreviewService) CreatePreviewFromLocalPath(localPath, subdir, previewFilename string, spec PreviewSpec) (string, error) {
	file, err := os.Open(localPath)
	if err != nil {
		return "", fmt.Errorf("打开原图失败: %w", err)
	}
	defer file.Close()

	img, _, err := image.Decode(file)
	if err != nil {
		return "", fmt.Errorf("解码原图失败: %w", err)
	}

	return s.persistPreviewImage(img, subdir, previewFilename, spec)
}

func (s *ImagePreviewService) createPreviewFromRemoteURL(ctx context.Context, sourceURL, subdir, previewFilename string, spec PreviewSpec) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return "", err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("下载原图失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("下载原图失败: HTTP %d", resp.StatusCode)
	}

	img, _, err := image.Decode(resp.Body)
	if err != nil {
		return "", fmt.Errorf("解码原图失败: %w", err)
	}

	return s.persistPreviewImage(img, subdir, previewFilename, spec)
}

func (s *ImagePreviewService) persistPreviewImage(img image.Image, subdir, previewFilename string, spec PreviewSpec) (string, error) {
	previewImage := renderPreview(img, spec)
	publicPath := GeneratedPublicPath(subdir, previewFilename)

	if s.ossService.IsEnabled() {
		tmp, err := os.CreateTemp("", "storyboard-preview-*.webp")
		if err != nil {
			return "", fmt.Errorf("创建缩略图临时文件失败: %w", err)
		}
		tmpPath := tmp.Name()
		_ = tmp.Close()
		defer os.Remove(tmpPath)

		if err := writeWebP(tmpPath, previewImage); err != nil {
			return "", err
		}
		if err := s.ossService.EnsureUploaded(tmpPath, publicPath); err != nil {
			return "", fmt.Errorf("上传缩略图到 OSS 失败: %w", err)
		}
		return publicPath, nil
	}

	previewPath, localPublicPath, err := s.prepareOutput(subdir, previewFilename)
	if err != nil {
		return "", err
	}
	if err := writeWebP(previewPath, previewImage); err != nil {
		return "", err
	}
	return localPublicPath, nil
}

func (s *ImagePreviewService) copyGeneratedToTempFile(source string) (string, func(), error) {
	tmp, err := os.CreateTemp("", "storyboard-preview-input-*")
	if err != nil {
		return "", nil, err
	}
	_ = tmp.Close()
	if err := s.ossService.DownloadGeneratedToFile(source, tmp.Name()); err != nil {
		_ = os.Remove(tmp.Name())
		return "", nil, err
	}
	cleanup := func() { _ = os.Remove(tmp.Name()) }
	return tmp.Name(), cleanup, nil
}

func (s *ImagePreviewService) resolveSourceToLocalPath(source string) (string, bool) {
	basePath := normalizedGeneratedBasePath()
	assetRoot, err := resolveGeneratedAssetRoot()
	if err != nil {
		return "", false
	}

	if strings.HasPrefix(source, basePath+"/") {
		trimmed := strings.TrimPrefix(source, basePath+"/")
		return filepath.Join(assetRoot, filepath.FromSlash(trimmed)), true
	}

	parsed, err := url.Parse(source)
	if err == nil && parsed.Path != "" && strings.HasPrefix(parsed.Path, basePath+"/") {
		trimmed := strings.TrimPrefix(parsed.Path, basePath+"/")
		return filepath.Join(assetRoot, filepath.FromSlash(trimmed)), true
	}

	return "", false
}

func (s *ImagePreviewService) prepareOutput(subdir, previewFilename string) (string, string, error) {
	assetRoot, err := resolveGeneratedAssetRoot()
	if err != nil {
		return "", "", err
	}

	outputDir := filepath.Join(assetRoot, subdir)
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		return "", "", fmt.Errorf("创建缩略图目录失败: %w", err)
	}

	localPath := filepath.Join(outputDir, previewFilename)
	publicPath := GeneratedPublicPath(subdir, previewFilename)
	return localPath, publicPath, nil
}

func resolveGeneratedAssetRoot() (string, error) {
	assetRoot := config.GlobalConfig.GeneratedAssetDir
	if filepath.IsAbs(assetRoot) {
		return assetRoot, nil
	}
	return filepath.Abs(filepath.Join(".", assetRoot))
}

func derivedPreviewFilename(localPath, baseName string) string {
	if strings.TrimSpace(baseName) != "" {
		return sanitizeFileName(baseName) + ".thumb.webp"
	}
	base := strings.TrimSuffix(filepath.Base(localPath), filepath.Ext(localPath))
	return sanitizeFileName(base) + ".thumb.webp"
}

func remotePreviewFilename(sourceURL, baseName string) string {
	if strings.TrimSpace(baseName) != "" {
		return fmt.Sprintf("%s-%d.thumb.webp", sanitizeFileName(baseName), time.Now().Unix())
	}
	hash := sha1.Sum([]byte(sourceURL))
	return fmt.Sprintf("preview-%s-%d.thumb.webp", hex.EncodeToString(hash[:6]), time.Now().Unix())
}

func sanitizeFileName(value string) string {
	replacer := strings.NewReplacer("/", "-", "\\", "-", " ", "-", ":", "-", "?", "", "&", "-", "=", "-", "#", "")
	cleaned := replacer.Replace(strings.TrimSpace(value))
	cleaned = strings.Trim(cleaned, "-._")
	if cleaned == "" {
		return "preview"
	}
	return cleaned
}

func renderPreview(src image.Image, spec PreviewSpec) image.Image {
	if spec.Width <= 0 || spec.Height <= 0 {
		return src
	}
	if spec.Crop {
		return resizeAndCrop(src, spec.Width, spec.Height)
	}
	return resizeToFit(src, spec.Width, spec.Height)
}

func resizeAndCrop(src image.Image, targetW, targetH int) image.Image {
	sw := float64(src.Bounds().Dx())
	sh := float64(src.Bounds().Dy())
	tw := float64(targetW)
	th := float64(targetH)
	if sw == 0 || sh == 0 {
		return image.NewNRGBA(image.Rect(0, 0, targetW, targetH))
	}

	scale := math.Max(tw/sw, th/sh)
	resizeW := int(math.Ceil(sw * scale))
	resizeH := int(math.Ceil(sh * scale))
	resized := image.NewNRGBA(image.Rect(0, 0, resizeW, resizeH))
	xdraw.CatmullRom.Scale(resized, resized.Bounds(), src, src.Bounds(), stddraw.Over, nil)

	offsetX := maxInt(0, (resizeW-targetW)/2)
	offsetY := maxInt(0, (resizeH-targetH)/2)
	cropped := image.NewNRGBA(image.Rect(0, 0, targetW, targetH))
	stddraw.Draw(cropped, cropped.Bounds(), resized, image.Pt(offsetX, offsetY), stddraw.Src)
	return cropped
}

func resizeToFit(src image.Image, maxW, maxH int) image.Image {
	sw := float64(src.Bounds().Dx())
	sh := float64(src.Bounds().Dy())
	if sw == 0 || sh == 0 {
		return image.NewNRGBA(image.Rect(0, 0, maxW, maxH))
	}
	if int(sw) <= maxW && int(sh) <= maxH {
		copyImg := image.NewNRGBA(image.Rect(0, 0, int(sw), int(sh)))
		stddraw.Draw(copyImg, copyImg.Bounds(), src, src.Bounds().Min, stddraw.Src)
		return copyImg
	}
	scale := math.Min(float64(maxW)/sw, float64(maxH)/sh)
	resizeW := maxInt(1, int(math.Round(sw*scale)))
	resizeH := maxInt(1, int(math.Round(sh*scale)))
	resized := image.NewNRGBA(image.Rect(0, 0, resizeW, resizeH))
	xdraw.CatmullRom.Scale(resized, resized.Bounds(), src, src.Bounds(), stddraw.Over, nil)
	return resized
}

func writeWebP(path string, img image.Image) error {
	file, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("创建缩略图文件失败: %w", err)
	}
	defer file.Close()

	if err := webp.Encode(file, img, &webp.Options{Lossless: false, Quality: 78}); err != nil {
		return fmt.Errorf("写入缩略图失败: %w", err)
	}
	if err := file.Sync(); err != nil {
		return fmt.Errorf("刷新缩略图失败: %w", err)
	}
	return nil
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func copyToTempFile(ctx context.Context, client *http.Client, sourceURL string) (string, func(), error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return "", nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", nil, fmt.Errorf("download failed: HTTP %d", resp.StatusCode)
	}
	tmp, err := os.CreateTemp("", "storyboard-preview-*.img")
	if err != nil {
		return "", nil, err
	}
	if _, err := io.Copy(tmp, resp.Body); err != nil {
		_ = tmp.Close()
		_ = os.Remove(tmp.Name())
		return "", nil, err
	}
	if err := tmp.Close(); err != nil {
		_ = os.Remove(tmp.Name())
		return "", nil, err
	}
	cleanup := func() { _ = os.Remove(tmp.Name()) }
	return tmp.Name(), cleanup, nil
}
