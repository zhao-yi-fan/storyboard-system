package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"storyboard-backend/config"
)

type SeedanceVideoClient struct {
	baseURL    string
	apiKey     string
	model      string
	httpClient *http.Client
}

type seedanceCreateTaskResponse struct {
	ID      string `json:"id"`
	Status  string `json:"status"`
	Message string `json:"message"`
	Error   *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func NewSeedanceVideoClient() *SeedanceVideoClient {
	timeout := config.GlobalConfig.SeedanceRequestTimeoutSeconds
	if timeout <= 0 {
		timeout = 300
	}

	return &SeedanceVideoClient{
		baseURL: strings.TrimRight(config.GlobalConfig.SeedanceBaseURL, "/"),
		apiKey:  strings.TrimSpace(config.GlobalConfig.SeedanceAPIKey),
		model:   strings.TrimSpace(config.GlobalConfig.SeedanceModel),
		httpClient: &http.Client{
			Timeout: time.Duration(timeout) * time.Second,
		},
	}
}

func (c *SeedanceVideoClient) GenerateVideo(ctx context.Context, prompt, imageURL, _ string, duration int) (string, float64, error) {
	if err := config.GlobalConfig.ValidateSeedanceVideoConfig(); err != nil {
		return "", 0, err
	}
	if strings.TrimSpace(imageURL) == "" {
		return "", 0, fmt.Errorf("Seedance 图生视频缺少首帧图")
	}
	if duration <= 0 {
		duration = 5
	}

	log.Printf("[seedance] generate start model=%s duration=%d image_url=%t prompt_len=%d", c.model, duration, strings.TrimSpace(imageURL) != "", len(strings.TrimSpace(prompt)))

	taskID, err := c.createTask(ctx, prompt, imageURL, duration)
	if err != nil {
		log.Printf("[seedance] create task failed model=%s err=%v", c.model, err)
		return "", 0, err
	}
	log.Printf("[seedance] task created model=%s task_id=%s duration=%d", c.model, taskID, duration)
	return c.waitForTask(ctx, taskID, duration)
}

func (c *SeedanceVideoClient) createTask(ctx context.Context, prompt, imageURL string, duration int) (string, error) {
	content := []map[string]any{
		{
			"type": "text",
			"text": prompt,
		},
		{
			"type": "image_url",
			"role": "first_frame",
			"image_url": map[string]any{
				"url": imageURL,
			},
		},
	}

	payload := map[string]any{
		"model":          c.model,
		"content":        content,
		"duration":       duration,
		"resolution":     "480p",
		"generate_audio": true,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("序列化 Seedance 请求失败: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/contents/generations/tasks", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("创建 Seedance 请求失败: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("提交 Seedance 视频任务失败: %w", err)
	}
	defer resp.Body.Close()

	var result seedanceCreateTaskResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("解析 Seedance 创建响应失败: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Printf("[seedance] create task bad response status=%d body=%s", resp.StatusCode, compactSeedancePayload(result))
		if result.Error != nil && strings.TrimSpace(result.Error.Message) != "" {
			return "", fmt.Errorf("提交 Seedance 视频任务失败: %s", result.Error.Message)
		}
		if strings.TrimSpace(result.Message) != "" {
			return "", fmt.Errorf("提交 Seedance 视频任务失败: %s", result.Message)
		}
		return "", fmt.Errorf("提交 Seedance 视频任务失败: HTTP %d", resp.StatusCode)
	}
	if strings.TrimSpace(result.ID) == "" {
		return "", fmt.Errorf("提交 Seedance 视频任务失败: 未返回任务 ID")
	}
	return result.ID, nil
}

func (c *SeedanceVideoClient) waitForTask(ctx context.Context, taskID string, duration int) (string, float64, error) {
	deadline := time.Now().Add(time.Duration(config.GlobalConfig.SeedanceRequestTimeoutSeconds) * time.Second)
	lastStatus := ""

	for {
		if time.Now().After(deadline) {
			log.Printf("[seedance] task timeout task_id=%s", taskID)
			return "", 0, fmt.Errorf("Seedance 视频任务超时")
		}

		videoURL, status, done, err := c.fetchTask(ctx, taskID)
		if err != nil {
			log.Printf("[seedance] task poll failed task_id=%s err=%v", taskID, err)
			return "", 0, err
		}
		if status != "" && status != lastStatus {
			log.Printf("[seedance] task status task_id=%s status=%s", taskID, status)
			lastStatus = status
		}
		if done {
			log.Printf("[seedance] task succeeded task_id=%s video_url=%s", taskID, videoURL)
			return videoURL, float64(duration), nil
		}

		select {
		case <-ctx.Done():
			return "", 0, ctx.Err()
		case <-time.After(10 * time.Second):
		}
	}
}

func (c *SeedanceVideoClient) fetchTask(ctx context.Context, taskID string) (string, string, bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/contents/generations/tasks/"+taskID, nil)
	if err != nil {
		return "", "", false, fmt.Errorf("创建 Seedance 查询请求失败: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", "", false, fmt.Errorf("查询 Seedance 视频任务失败: %w", err)
	}
	defer resp.Body.Close()

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", "", false, fmt.Errorf("解析 Seedance 查询响应失败: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Printf("[seedance] task query bad response task_id=%s status=%d body=%s", taskID, resp.StatusCode, compactSeedancePayload(result))
		return "", "", false, fmt.Errorf("查询 Seedance 视频任务失败: %s", firstSeedanceMessage(result, fmt.Sprintf("HTTP %d", resp.StatusCode)))
	}

	status := strings.ToLower(strings.TrimSpace(stringValue(result["status"])))
	switch status {
	case "succeeded", "success", "completed":
		videoURL := findFirstVideoURL(result)
		if videoURL == "" {
			log.Printf("[seedance] task missing video url task_id=%s body=%s", taskID, compactSeedancePayload(result))
			return "", status, false, fmt.Errorf("Seedance 视频任务成功但未返回视频地址")
		}
		return videoURL, status, true, nil
	case "failed", "error", "canceled", "cancelled":
		log.Printf("[seedance] task failed task_id=%s body=%s", taskID, compactSeedancePayload(result))
		return "", status, false, fmt.Errorf("Seedance 视频任务失败: %s", firstSeedanceMessage(result, "未知错误"))
	default:
		return "", status, false, nil
	}
}

func compactSeedancePayload(payload any) string {
	body, err := json.Marshal(payload)
	if err != nil {
		return "<marshal-error>"
	}
	const limit = 800
	if len(body) > limit {
		return string(body[:limit]) + "...(truncated)"
	}
	return string(body)
}

func firstSeedanceMessage(payload map[string]any, fallback string) string {
	if payload == nil {
		return fallback
	}
	if value := findNestedString(payload, "message"); value != "" {
		return value
	}
	if value := findNestedString(payload, "msg"); value != "" {
		return value
	}
	return fallback
}

func findNestedString(value any, key string) string {
	switch typed := value.(type) {
	case map[string]any:
		if raw, ok := typed[key]; ok {
			if text := stringValue(raw); text != "" {
				return text
			}
		}
		for _, child := range typed {
			if nested := findNestedString(child, key); nested != "" {
				return nested
			}
		}
	case []any:
		for _, child := range typed {
			if nested := findNestedString(child, key); nested != "" {
				return nested
			}
		}
	}
	return ""
}

func findFirstVideoURL(value any) string {
	switch typed := value.(type) {
	case map[string]any:
		for key, child := range typed {
			if text := stringValue(child); text != "" && likelyVideoURL(text, key) {
				return text
			}
			if nested := findFirstVideoURL(child); nested != "" {
				return nested
			}
		}
	case []any:
		for _, child := range typed {
			if nested := findFirstVideoURL(child); nested != "" {
				return nested
			}
		}
	case string:
		if likelyVideoURL(typed, "") {
			return typed
		}
	}
	return ""
}

func stringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	default:
		return ""
	}
}

func likelyVideoURL(value, key string) bool {
	text := strings.TrimSpace(strings.ToLower(value))
	if text == "" {
		return false
	}
	if !strings.HasPrefix(text, "http://") && !strings.HasPrefix(text, "https://") {
		return false
	}
	if strings.Contains(strings.ToLower(key), "video") {
		return true
	}
	switch strings.ToLower(filepath.Ext(text)) {
	case ".mp4", ".mov", ".m4v", ".webm":
		return true
	default:
		return false
	}
}
