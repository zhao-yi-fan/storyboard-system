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

type WanxClient struct {
	baseURL    string
	apiKey     string
	model      string
	httpClient *http.Client
}

type wanxGenerateRequest struct {
	Model      string                 `json:"model"`
	Input      map[string]any         `json:"input"`
	Parameters map[string]any         `json:"parameters,omitempty"`
}

type wanxCreateTaskResponse struct {
	RequestID string `json:"request_id"`
	Code      string `json:"code"`
	Message   string `json:"message"`
	Output    struct {
		TaskID string `json:"task_id"`
	} `json:"output"`
}

type wanxTaskResponse struct {
	RequestID string `json:"request_id"`
	Code      string `json:"code"`
	Message   string `json:"message"`
	Output    struct {
		TaskStatus string `json:"task_status"`
		Results    []struct {
			URL string `json:"url"`
		} `json:"results"`
		TaskMetrics map[string]any `json:"task_metrics"`
	} `json:"output"`
}

func NewWanxClient() (*WanxClient, error) {
	if err := config.GlobalConfig.ValidateWanxConfig(); err != nil {
		return nil, err
	}

	return &WanxClient{
		baseURL: strings.TrimRight(config.GlobalConfig.WanxBaseURL, "/"),
		apiKey:  config.GlobalConfig.DashScopeAPIKey,
		model:   config.GlobalConfig.WanxModel,
		httpClient: &http.Client{
			Timeout: time.Duration(config.GlobalConfig.WanxRequestTimeoutSeconds) * time.Second,
		},
	}, nil
}

func (c *WanxClient) GenerateImage(ctx context.Context, prompt string) (string, error) {
	taskID, err := c.createTask(ctx, prompt)
	if err != nil {
		return "", err
	}

	return c.waitForTask(ctx, taskID)
}

func (c *WanxClient) createTask(ctx context.Context, prompt string) (string, error) {
	payload := wanxGenerateRequest{
		Model: c.model,
		Input: map[string]any{
			"prompt": prompt,
		},
		Parameters: map[string]any{
			"size": "1024*1024",
			"n":    1,
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/services/aigc/text2image/image-synthesis", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-DashScope-Async", "enable")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("提交万相任务失败: %w", err)
	}
	defer resp.Body.Close()

	var result wanxCreateTaskResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("解析万相任务创建响应失败: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("提交万相任务失败: %s %s", result.Code, result.Message)
	}
	if result.Output.TaskID == "" {
		return "", fmt.Errorf("提交万相任务失败: 未返回 task_id")
	}

	return result.Output.TaskID, nil
}

func (c *WanxClient) waitForTask(ctx context.Context, taskID string) (string, error) {
	deadline := time.Now().Add(time.Duration(config.GlobalConfig.WanxRequestTimeoutSeconds) * time.Second)

	for {
		if time.Now().After(deadline) {
			return "", fmt.Errorf("万相任务超时")
		}

		url, done, err := c.fetchTask(ctx, taskID)
		if err != nil {
			return "", err
		}
		if done {
			return url, nil
		}

		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}
}

func (c *WanxClient) fetchTask(ctx context.Context, taskID string) (string, bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/tasks/"+taskID, nil)
	if err != nil {
		return "", false, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", false, fmt.Errorf("查询万相任务失败: %w", err)
	}
	defer resp.Body.Close()

	var result wanxTaskResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", false, fmt.Errorf("解析万相任务结果失败: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", false, fmt.Errorf("查询万相任务失败: %s %s", result.Code, result.Message)
	}

	switch result.Output.TaskStatus {
	case "SUCCEEDED":
		if len(result.Output.Results) == 0 || result.Output.Results[0].URL == "" {
			return "", false, fmt.Errorf("万相任务成功但未返回图片 URL")
		}
		return result.Output.Results[0].URL, true, nil
	case "FAILED", "CANCELED":
		if result.Message != "" {
			return "", false, fmt.Errorf("万相任务失败: %s", result.Message)
		}
		return "", false, fmt.Errorf("万相任务失败")
	default:
		return "", false, nil
	}
}
