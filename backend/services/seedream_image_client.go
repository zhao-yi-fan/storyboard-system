package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"storyboard-backend/config"
)

type SeedreamImageClient struct {
	baseURL    string
	apiKey     string
	model      string
	httpClient *http.Client
}

type seedreamImageRequest struct {
	Model          string `json:"model"`
	Prompt         string `json:"prompt"`
	Image          any    `json:"image,omitempty"`
	Size           string `json:"size,omitempty"`
	ResponseFormat string `json:"response_format,omitempty"`
	Watermark      bool   `json:"watermark"`
}

func NewSeedreamImageClient() (*SeedreamImageClient, error) {
	if err := config.GlobalConfig.ValidateSeedreamImageConfig(); err != nil {
		return nil, err
	}

	timeout := config.GlobalConfig.SeedreamImageTimeoutSeconds
	if timeout <= 0 {
		timeout = 180
	}

	return &SeedreamImageClient{
		baseURL: strings.TrimRight(config.GlobalConfig.SeedreamImageBaseURL, "/"),
		apiKey:  strings.TrimSpace(config.GlobalConfig.SeedreamImageAPIKey),
		model:   strings.TrimSpace(config.GlobalConfig.SeedreamImageModel),
		httpClient: &http.Client{
			Timeout: time.Duration(timeout) * time.Second,
		},
	}, nil
}

func (c *SeedreamImageClient) GenerateImage(ctx context.Context, prompt string, imageURLs []string) (string, error) {
	payload := seedreamImageRequest{
		Model:          c.model,
		Prompt:         strings.TrimSpace(prompt),
		Size:           "2048x1152",
		ResponseFormat: "url",
		Watermark:      false,
	}
	switch len(imageURLs) {
	case 0:
	case 1:
		payload.Image = strings.TrimSpace(imageURLs[0])
	default:
		images := make([]string, 0, len(imageURLs))
		for _, imageURL := range imageURLs {
			if trimmed := strings.TrimSpace(imageURL); trimmed != "" {
				images = append(images, trimmed)
			}
		}
		if len(images) == 1 {
			payload.Image = images[0]
		} else if len(images) > 1 {
			payload.Image = images
		}
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("序列化 Seedream 4.5 请求失败: %w", err)
	}

	paths := []string{"/online/images/generations", "/images/generations"}
	var lastErr error
	for _, path := range paths {
		imageURL, err := c.requestGenerate(ctx, path, body)
		if err == nil {
			return imageURL, nil
		}
		lastErr = err
		if !strings.Contains(err.Error(), "HTTP 404") {
			break
		}
	}

	if lastErr == nil {
		lastErr = fmt.Errorf("Seedream 4.5 生图失败")
	}
	return "", lastErr
}

func (c *SeedreamImageClient) requestGenerate(ctx context.Context, path string, body []byte) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("创建 Seedream 4.5 请求失败: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("提交 Seedream 4.5 生图请求失败: %w", err)
	}
	defer resp.Body.Close()

	var payload map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", fmt.Errorf("解析 Seedream 4.5 响应失败: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		message := seedreamFirstMessage(payload)
		if message == "" {
			message = fmt.Sprintf("HTTP %d", resp.StatusCode)
		}
		return "", fmt.Errorf("提交 Seedream 4.5 生图请求失败: %s", message)
	}

	imageURL := seedreamExtractURL(payload)
	if imageURL == "" {
		return "", fmt.Errorf("Seedream 4.5 生图成功但未返回图片 URL")
	}
	return imageURL, nil
}

func seedreamExtractURL(payload map[string]any) string {
	if payload == nil {
		return ""
	}
	if nested, ok := payload["data"].(map[string]any); ok {
		if list, ok := nested["data"].([]any); ok {
			for _, item := range list {
				if record, ok := item.(map[string]any); ok {
					if url, ok := record["url"].(string); ok && strings.TrimSpace(url) != "" {
						return strings.TrimSpace(url)
					}
				}
			}
		}
	}
	if list, ok := payload["data"].([]any); ok {
		for _, item := range list {
			if record, ok := item.(map[string]any); ok {
				if url, ok := record["url"].(string); ok && strings.TrimSpace(url) != "" {
					return strings.TrimSpace(url)
				}
			}
		}
	}
	return ""
}

func seedreamFirstMessage(payload map[string]any) string {
	if payload == nil {
		return ""
	}
	for _, key := range []string{"message", "msg"} {
		if value, ok := payload[key].(string); ok && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	if nested, ok := payload["data"].(map[string]any); ok {
		if errInfo, ok := nested["error"].(map[string]any); ok {
			if value, ok := errInfo["message"].(string); ok && strings.TrimSpace(value) != "" {
				return strings.TrimSpace(value)
			}
		}
	}
	if errInfo, ok := payload["error"].(map[string]any); ok {
		if value, ok := errInfo["message"].(string); ok && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
