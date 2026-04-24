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

type WanxVideoClient struct {
	baseURL    string
	apiKey     string
	model      string
	httpClient *http.Client
}

type wanxVideoCreateTaskResponse struct {
	RequestID string `json:"request_id"`
	Code      string `json:"code"`
	Message   string `json:"message"`
	Output    struct {
		TaskID     string `json:"task_id"`
		TaskStatus string `json:"task_status"`
	} `json:"output"`
}

type wanxVideoTaskResponse struct {
	RequestID string `json:"request_id"`
	Code      string `json:"code"`
	Message   string `json:"message"`
	Output    struct {
		TaskID     string `json:"task_id"`
		TaskStatus string `json:"task_status"`
		Code       string `json:"code"`
		Message    string `json:"message"`
		VideoURL   string `json:"video_url"`
	} `json:"output"`
	Usage struct {
		OutputVideoDuration float64 `json:"output_video_duration"`
		Duration            float64 `json:"duration"`
	} `json:"usage"`
}

func NewWanxVideoClient() (*WanxVideoClient, error) {
	return &WanxVideoClient{
		baseURL: strings.TrimRight(config.GlobalConfig.WanxVideoBaseURL, "/"),
		apiKey:  config.GlobalConfig.DashScopeAPIKey,
		model:   config.GlobalConfig.WanxVideoModel,
		httpClient: &http.Client{
			Timeout: time.Duration(config.GlobalConfig.WanxVideoRequestTimeoutSeconds) * time.Second,
		},
	}, nil
}

func (c *WanxVideoClient) GenerateVideo(ctx context.Context, prompt, imageURL, model string, duration int) (string, float64, error) {
	if err := config.GlobalConfig.ValidateWanxVideoConfig(); err != nil {
		return "", 0, err
	}
	taskID, err := c.createTask(ctx, prompt, imageURL, model, duration)
	if err != nil {
		return "", 0, err
	}

	return c.waitForTask(ctx, taskID)
}

func (c *WanxVideoClient) createTask(ctx context.Context, prompt, imageURL, model string, duration int) (string, error) {
	if strings.TrimSpace(model) == "" {
		model = c.model
	}
	if duration == 0 {
		duration = 5
	}

	payload := map[string]any{
		"model": model,
		"parameters": map[string]any{
			"resolution":    "720P",
			"duration":      duration,
			"prompt_extend": true,
			"watermark":     false,
		},
	}

	if model == "wan2.7-i2v" {
		payload["input"] = map[string]any{
			"prompt": prompt,
			"media": []map[string]any{
				{
					"type": "first_frame",
					"url":  imageURL,
				},
			},
		}
	} else {
		payload["input"] = map[string]any{
			"prompt":  prompt,
			"img_url": imageURL,
		}
		payload["parameters"].(map[string]any)["audio"] = true
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/services/aigc/video-generation/video-synthesis", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-DashScope-Async", "enable")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("提交视频生成任务失败: %w", err)
	}
	defer resp.Body.Close()

	var result wanxVideoCreateTaskResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("解析视频任务创建响应失败: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("提交视频生成任务失败: %s %s", result.Code, result.Message)
	}
	if result.Output.TaskID == "" {
		return "", fmt.Errorf("提交视频生成任务失败: 未返回 task_id")
	}

	return result.Output.TaskID, nil
}

func (c *WanxVideoClient) waitForTask(ctx context.Context, taskID string) (string, float64, error) {
	deadline := time.Now().Add(time.Duration(config.GlobalConfig.WanxVideoRequestTimeoutSeconds) * time.Second)

	for {
		if time.Now().After(deadline) {
			return "", 0, fmt.Errorf("视频生成任务超时")
		}

		videoURL, duration, done, err := c.fetchTask(ctx, taskID)
		if err != nil {
			return "", 0, err
		}
		if done {
			return videoURL, duration, nil
		}

		select {
		case <-ctx.Done():
			return "", 0, ctx.Err()
		case <-time.After(15 * time.Second):
		}
	}
}

func (c *WanxVideoClient) fetchTask(ctx context.Context, taskID string) (string, float64, bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/tasks/"+taskID, nil)
	if err != nil {
		return "", 0, false, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", 0, false, fmt.Errorf("查询视频生成任务失败: %w", err)
	}
	defer resp.Body.Close()

	var result wanxVideoTaskResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", 0, false, fmt.Errorf("解析视频任务结果失败: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", 0, false, fmt.Errorf("查询视频生成任务失败: %s %s", result.Code, result.Message)
	}

	switch result.Output.TaskStatus {
	case "SUCCEEDED":
		if result.Output.VideoURL == "" {
			return "", 0, false, fmt.Errorf("视频任务成功但未返回 video_url")
		}
		duration := result.Usage.OutputVideoDuration
		if duration <= 0 {
			duration = result.Usage.Duration
		}
		return result.Output.VideoURL, duration, true, nil
	case "FAILED", "CANCELED":
		if result.Output.Message != "" {
			return "", 0, false, fmt.Errorf("视频任务失败: %s", result.Output.Message)
		}
		if result.Message != "" {
			return "", 0, false, fmt.Errorf("视频任务失败: %s", result.Message)
		}
		return "", 0, false, fmt.Errorf("视频任务失败")
	default:
		return "", 0, false, nil
	}
}
