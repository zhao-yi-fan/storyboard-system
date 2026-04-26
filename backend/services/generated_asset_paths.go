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

func NormalizeGeneratedAssetReference(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	if IsGeneratedAssetPath(trimmed) {
		return trimmed
	}

	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Host == "" || parsed.Path == "" {
		return trimmed
	}

	if !isManagedOSSHost(parsed.Host) {
		return trimmed
	}

	objectKey := strings.TrimPrefix(path.Clean(parsed.Path), "/")
	if objectKey == "" || objectKey == "." {
		return trimmed
	}
	return GeneratedPublicPathFromObjectKey(objectKey)
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

func isManagedOSSHost(host string) bool {
	trimmedHost := strings.TrimSpace(strings.ToLower(host))
	if trimmedHost == "" {
		return false
	}

	managedHosts := []string{
		strings.ToLower(strings.TrimSpace(config.GlobalConfig.AliyunOSSEndpoint)),
		strings.ToLower(strings.TrimSpace(config.GlobalConfig.AliyunOSSPublicEndpoint)),
	}

	bucket := strings.ToLower(strings.TrimSpace(config.GlobalConfig.AliyunOSSBucket))
	for _, candidate := range managedHosts {
		if candidate == "" {
			continue
		}
		candidate = strings.TrimPrefix(candidate, "https://")
		candidate = strings.TrimPrefix(candidate, "http://")
		if trimmedHost == candidate {
			return true
		}
		if bucket != "" && trimmedHost == bucket+"."+candidate {
			return true
		}
	}

	return false
}
