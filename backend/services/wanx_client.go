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
	baseURL        string
	apiKey         string
	model          string
	referenceModel string
	httpClient     *http.Client
}

type wanxAsyncCreateTaskResponse struct {
	RequestID string `json:"request_id"`
	Code      string `json:"code"`
	Message   string `json:"message"`
	Output    struct {
		TaskID string `json:"task_id"`
	} `json:"output"`
}

type wanxAsyncTaskResponse struct {
	RequestID string `json:"request_id"`
	Code      string `json:"code"`
	Message   string `json:"message"`
	Output    struct {
		TaskStatus string `json:"task_status"`
		Results    []struct {
			URL string `json:"url"`
		} `json:"results"`
	} `json:"output"`
}

type qwenImageSyncRequest struct {
	Model string `json:"model"`
	Input struct {
		Messages []struct {
			Role    string `json:"role"`
			Content []struct {
				Text string `json:"text"`
			} `json:"content"`
		} `json:"messages"`
	} `json:"input"`
	Parameters map[string]any `json:"parameters,omitempty"`
}

type qwenImageSyncResponse struct {
	RequestID string `json:"request_id"`
	Code      string `json:"code"`
	Message   string `json:"message"`
	Output    struct {
		Choices []struct {
			Message struct {
				Content []struct {
					Image string `json:"image"`
				} `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	} `json:"output"`
}

type multimodalContentItem struct {
	Type  string `json:"type"`
	Text  string `json:"text,omitempty"`
	Image string `json:"image,omitempty"`
}

type multimodalImageRequest struct {
	Model string `json:"model"`
	Input struct {
		Messages []struct {
			Role    string                  `json:"role"`
			Content []multimodalContentItem `json:"content"`
		} `json:"messages"`
	} `json:"input"`
	Parameters map[string]any `json:"parameters,omitempty"`
}

func NewWanxClient() (*WanxClient, error) {
	if err := config.GlobalConfig.ValidateWanxConfig(); err != nil {
		return nil, err
	}

	return &WanxClient{
		baseURL:        strings.TrimRight(config.GlobalConfig.WanxBaseURL, "/"),
		apiKey:         config.GlobalConfig.DashScopeAPIKey,
		model:          config.GlobalConfig.WanxModel,
		referenceModel: config.GlobalConfig.WanxReferenceModel,
		httpClient: &http.Client{
			Timeout: time.Duration(config.GlobalConfig.WanxRequestTimeoutSeconds) * time.Second,
		},
	}, nil
}

func (c *WanxClient) GenerateImage(ctx context.Context, prompt string) (string, error) {
	return c.GenerateImageWithModel(ctx, prompt, c.model)
}

func (c *WanxClient) GenerateImageWithReferences(ctx context.Context, prompt string, imageURLs []string, model string) (string, error) {
	if len(imageURLs) == 0 {
		return c.GenerateImage(ctx, prompt)
	}
	selectedModel := strings.TrimSpace(model)
	if selectedModel == "" {
		selectedModel = strings.TrimSpace(c.referenceModel)
	}
	if selectedModel == "" {
		selectedModel = "wan2.7-image-pro"
	}
	return c.generateMultimodalSync(ctx, prompt, imageURLs, selectedModel)
}

func (c *WanxClient) GenerateImageWithModel(ctx context.Context, prompt, model string) (string, error) {
	selectedModel := strings.TrimSpace(model)
	if selectedModel == "" {
		selectedModel = strings.TrimSpace(c.model)
	}
	if selectedModel == "" {
		return "", fmt.Errorf("未配置可用的生图模型")
	}
	if usesQwenSyncModel(selectedModel) {
		return c.generateMultimodalSync(ctx, prompt, nil, selectedModel)
	}
	taskID, err := c.createWanxAsyncTaskWithModel(ctx, prompt, selectedModel)
	if err != nil {
		return "", err
	}
	return c.waitForWanxTask(ctx, taskID)
}

func (c *WanxClient) usesQwenSyncAPI() bool {
	return usesQwenSyncModel(c.model)
}

func usesQwenSyncModel(model string) bool {
	return strings.HasPrefix(strings.TrimSpace(model), "qwen-image-2.0") || strings.HasPrefix(strings.TrimSpace(model), "qwen-image-max")
}

func (c *WanxClient) generateMultimodalSync(ctx context.Context, prompt string, imageURLs []string, model string) (string, error) {
	var payload multimodalImageRequest
	payload.Model = model
	message := struct {
		Role    string                  `json:"role"`
		Content []multimodalContentItem `json:"content"`
	}{Role: "user"}
	for _, imageURL := range imageURLs {
		trimmed := strings.TrimSpace(imageURL)
		if trimmed == "" {
			continue
		}
		message.Content = append(message.Content, multimodalContentItem{Type: "image", Image: trimmed})
	}
	message.Content = append(message.Content, multimodalContentItem{Type: "text", Text: prompt})
	payload.Input.Messages = append(payload.Input.Messages, message)
	payload.Parameters = map[string]any{
		"negative_prompt": "低分辨率，低画质，构图混乱，文字模糊，水印，过度AI感，肢体畸形",
		"prompt_extend":   false,
		"watermark":       false,
		"size":            "1024*576",
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/services/aigc/multimodal-generation/generation", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("提交参考图生图请求失败: %w", err)
	}
	defer resp.Body.Close()

	var result qwenImageSyncResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("解析参考图生图响应失败: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("提交参考图生图请求失败: %s %s", result.Code, result.Message)
	}
	if len(result.Output.Choices) == 0 || len(result.Output.Choices[0].Message.Content) == 0 || result.Output.Choices[0].Message.Content[0].Image == "" {
		return "", fmt.Errorf("参考图生图成功但未返回图片 URL")
	}

	return result.Output.Choices[0].Message.Content[0].Image, nil
}

func (c *WanxClient) createWanxAsyncTask(ctx context.Context, prompt string) (string, error) {
	return c.createWanxAsyncTaskWithModel(ctx, prompt, c.model)
}

func (c *WanxClient) createWanxAsyncTaskWithModel(ctx context.Context, prompt, model string) (string, error) {
	payload := map[string]any{
		"model": model,
		"input": map[string]any{
			"prompt": prompt,
		},
		"parameters": map[string]any{
			"size":            "1024*576",
			"n":               1,
			"prompt_extend":   false,
			"watermark":       false,
			"negative_prompt": "低分辨率，低画质，构图混乱，文字模糊，水印，过度AI感，肢体畸形",
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

	var result wanxAsyncCreateTaskResponse
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

func (c *WanxClient) waitForWanxTask(ctx context.Context, taskID string) (string, error) {
	deadline := time.Now().Add(time.Duration(config.GlobalConfig.WanxRequestTimeoutSeconds) * time.Second)

	for {
		if time.Now().After(deadline) {
			return "", fmt.Errorf("万相任务超时")
		}

		url, done, err := c.fetchWanxTask(ctx, taskID)
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

func (c *WanxClient) fetchWanxTask(ctx context.Context, taskID string) (string, bool, error) {
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

	var result wanxAsyncTaskResponse
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
