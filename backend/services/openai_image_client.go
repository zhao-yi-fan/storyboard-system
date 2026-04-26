package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"storyboard-backend/config"
)

type OpenAIImageClient struct {
	baseURL    string
	apiKey     string
	model      string
	httpClient *http.Client
}

type openAIImageGenerationRequest struct {
	Model        string `json:"model"`
	Prompt       string `json:"prompt"`
	Size         string `json:"size,omitempty"`
	Quality      string `json:"quality,omitempty"`
	OutputFormat string `json:"output_format,omitempty"`
	Background   string `json:"background,omitempty"`
	N            int    `json:"n,omitempty"`
}

type openAIImageGenerationResponse struct {
	Data []struct {
		B64JSON string `json:"b64_json"`
	} `json:"data"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error,omitempty"`
}

func NewOpenAIImageClient() (*OpenAIImageClient, error) {
	if err := config.GlobalConfig.ValidateOpenAIImageConfig(); err != nil {
		return nil, err
	}

	return &OpenAIImageClient{
		baseURL: strings.TrimRight(config.GlobalConfig.OpenAIImageBaseURL, "/"),
		apiKey:  config.GlobalConfig.OpenAIAPIKey,
		model:   config.GlobalConfig.OpenAIImageModel,
		httpClient: &http.Client{
			Timeout: time.Duration(config.GlobalConfig.OpenAIImageTimeoutSeconds) * time.Second,
		},
	}, nil
}

func (c *OpenAIImageClient) GenerateImage(ctx context.Context, prompt string) ([]byte, error) {
	return c.GenerateImageWithModel(ctx, prompt, c.model)
}

func (c *OpenAIImageClient) GenerateImageWithModel(ctx context.Context, prompt, model string) ([]byte, error) {
	selectedModel := strings.TrimSpace(model)
	if selectedModel == "" {
		selectedModel = strings.TrimSpace(c.model)
	}
	if selectedModel == "" {
		return nil, fmt.Errorf("未配置可用的 OpenAI 生图模型")
	}

	payload := openAIImageGenerationRequest{
		Model:        selectedModel,
		Prompt:       prompt,
		Size:         "1536x1024",
		Quality:      "medium",
		OutputFormat: "png",
		Background:   "opaque",
		N:            1,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/images/generations", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("提交 GPT Image 2 请求失败: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取 GPT Image 2 响应失败: %w", err)
	}

	var result openAIImageGenerationResponse
	if err := json.Unmarshal(bodyBytes, &result); err != nil {
		return nil, fmt.Errorf("解析 GPT Image 2 响应失败: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if result.Error != nil && strings.TrimSpace(result.Error.Message) != "" {
			return nil, fmt.Errorf("提交 GPT Image 2 请求失败: %s", result.Error.Message)
		}
		return nil, fmt.Errorf("提交 GPT Image 2 请求失败: HTTP %d", resp.StatusCode)
	}
	if len(result.Data) == 0 || strings.TrimSpace(result.Data[0].B64JSON) == "" {
		return nil, fmt.Errorf("GPT Image 2 成功响应但未返回图片内容")
	}

	imageBytes, err := base64.StdEncoding.DecodeString(result.Data[0].B64JSON)
	if err != nil {
		return nil, fmt.Errorf("解析 GPT Image 2 图片内容失败: %w", err)
	}
	return imageBytes, nil
}
