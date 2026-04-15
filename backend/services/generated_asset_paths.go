package services

import (
	"fmt"
	"net/url"
	"path"
	"path/filepath"
	"strings"

	"storyboard-backend/config"
)

func normalizedGeneratedBasePath() string {
	base := strings.TrimSpace(config.GlobalConfig.GeneratedAssetBasePath)
	if base == "" {
		return "/generated"
	}
	base = "/" + strings.Trim(base, "/")
	return base
}

func GeneratedPublicPath(subdir, filename string) string {
	return GeneratedPublicPathFromObjectKey(path.Join(strings.Trim(subdir, "/"), filename))
}

func GeneratedPublicPathFromObjectKey(objectKey string) string {
	cleaned := strings.TrimPrefix(path.Clean("/"+strings.TrimSpace(objectKey)), "/")
	return normalizedGeneratedBasePath() + "/" + cleaned
}

func GeneratedObjectKeyFromParts(subdir, filename string) string {
	return path.Join(strings.Trim(subdir, "/"), filename)
}

func IsGeneratedAssetPath(raw string) bool {
	_, err := GeneratedObjectKey(raw)
	return err == nil
}

func GeneratedObjectKey(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", fmt.Errorf("empty generated path")
	}

	if parsed, err := url.Parse(trimmed); err == nil && parsed.Path != "" {
		trimmed = parsed.Path
	}

	base := normalizedGeneratedBasePath()
	if !strings.HasPrefix(trimmed, base+"/") {
		return "", fmt.Errorf("not a generated path: %s", raw)
	}

	relative := strings.TrimPrefix(trimmed, base+"/")
	relative = strings.TrimPrefix(path.Clean("/"+relative), "/")
	if relative == "" || strings.HasPrefix(relative, "../") {
		return "", fmt.Errorf("invalid generated path: %s", raw)
	}
	return relative, nil
}

func generatedObjectKeyToLocalPath(objectKey string) (string, error) {
	assetRoot, err := resolveGeneratedAssetRoot()
	if err != nil {
		return "", err
	}
	return filepath.Join(assetRoot, filepath.FromSlash(objectKey)), nil
}
