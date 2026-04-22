package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"storyboard-backend/config"
)

type llmStoryboardDocument struct {
	Chapters   []llmChapter   `json:"chapters"`
	Characters []llmCharacter `json:"characters"`
}

type llmChapter struct {
	Title   string     `json:"title"`
	Summary string     `json:"summary"`
	Order   int        `json:"order"`
	Scenes  []llmScene `json:"scenes"`
}

type llmScene struct {
	Title       string          `json:"title"`
	Summary     string          `json:"summary"`
	Location    string          `json:"location"`
	TimeOfDay   string          `json:"time_of_day"`
	Order       int             `json:"order"`
	Characters  []string        `json:"characters"`
	Storyboards []llmStoryboard `json:"storyboards"`
}

type llmStoryboard struct {
	Order             int      `json:"order"`
	ShotNumber        int      `json:"shot_number"`
	VisualDescription string   `json:"visual_description"`
	Dialogue          string   `json:"dialogue"`
	DurationSeconds   float64  `json:"duration_seconds"`
	ShotType          string   `json:"shot_type"`
	CameraAngle       string   `json:"camera_angle"`
	Mood              string   `json:"mood"`
	Notes             string   `json:"notes"`
	Characters        []string `json:"characters"`
}

type llmCharacter struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Appearance  string   `json:"appearance"`
	Tags        []string `json:"tags"`
}

type llmScriptModelClient interface {
	ParseScript(ctx context.Context, scriptText string) (*llmStoryboardDocument, error)
}

type ArkClient struct {
	baseURL    string
	apiKey     string
	model      string
	httpClient *http.Client
}

type arkChatRequest struct {
	Model       string       `json:"model"`
	Messages    []arkMessage `json:"messages"`
	Temperature float64      `json:"temperature"`
}

type arkMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type arkChatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error,omitempty"`
}

func NewArkClient() *ArkClient {
	timeout := config.GlobalConfig.ArkRequestTimeoutSeconds
	if timeout <= 0 {
		timeout = 180
	}

	return &ArkClient{
		baseURL: strings.TrimRight(config.GlobalConfig.ArkBaseURL, "/"),
		apiKey:  strings.TrimSpace(config.GlobalConfig.ArkAPIKey),
		model:   strings.TrimSpace(config.GlobalConfig.ArkModel),
		httpClient: &http.Client{
			Timeout: time.Duration(timeout) * time.Second,
		},
	}
}

func (c *ArkClient) ParseScript(ctx context.Context, scriptText string) (*llmStoryboardDocument, error) {
	if err := config.GlobalConfig.ValidateArkConfig(); err != nil {
		return nil, err
	}

	payload := arkChatRequest{
		Model:       c.model,
		Temperature: 0.2,
		Messages: []arkMessage{
			{
				Role:    "system",
				Content: arkStoryboardSystemPrompt,
			},
			{
				Role:    "user",
				Content: buildArkStoryboardUserPrompt(scriptText),
			},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("序列化 Ark 请求失败: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("创建 Ark 请求失败: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("调用 Ark 解析失败: %s", humanizeArkRequestError(err))
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取 Ark 响应失败: %w", err)
	}

	var parsedResp arkChatResponse
	if err := json.Unmarshal(respBody, &parsedResp); err != nil {
		return nil, fmt.Errorf("解析 Ark 响应失败: %w", err)
	}

	if resp.StatusCode >= http.StatusBadRequest {
		if parsedResp.Error != nil && parsedResp.Error.Message != "" {
			return nil, fmt.Errorf("Ark 解析失败: %s", parsedResp.Error.Message)
		}
		return nil, fmt.Errorf("Ark 解析失败: HTTP %d", resp.StatusCode)
	}

	if parsedResp.Error != nil && parsedResp.Error.Message != "" {
		return nil, fmt.Errorf("Ark 解析失败: %s", parsedResp.Error.Message)
	}

	if len(parsedResp.Choices) == 0 {
		return nil, fmt.Errorf("Ark 解析失败：未返回候选结果")
	}

	content := strings.TrimSpace(parsedResp.Choices[0].Message.Content)
	if content == "" {
		return nil, fmt.Errorf("Ark 解析失败：返回内容为空")
	}

	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	content = extractJSONObject(content)

	var document llmStoryboardDocument
	if err := json.Unmarshal([]byte(content), &document); err != nil {
		return nil, fmt.Errorf("Ark 解析失败：模型未返回合法 JSON")
	}

	return &document, nil
}

func humanizeArkRequestError(err error) string {
	if err == nil {
		return "未知错误"
	}

	switch {
	case errors.Is(err, context.DeadlineExceeded):
		return "方舟响应超时，请重试"
	}

	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return "方舟响应超时，请重试"
	}

	if strings.Contains(err.Error(), "Client.Timeout") || strings.Contains(err.Error(), "context deadline exceeded") {
		return "方舟响应超时，请重试"
	}

	return err.Error()
}

const arkStoryboardSystemPrompt = `你是一个影视分镜整理助手。你的任务是把任意小说片段、剧本文本或叙事内容整理成可直接导入分镜系统的结构化 JSON。你只能输出一个 JSON 对象，不要输出解释、不要输出 Markdown、不要输出代码块、不要输出额外文本。没有明确章节时，自动合理分章；至少输出 1 个章节、每章至少 1 个场景、每个场景至少 1 个分镜。characters 字段只能填写人物/角色名字，绝对不能填写场景标题、地点、时间、氛围描述、镜头描述，也不能把多个信息用标点连接成一个字符串。每个 storyboard 都必须填写 visual_description，不能留空；如果原文没有直接描写，也要根据上下文补出可视化画面描述。`

func buildArkStoryboardUserPrompt(scriptText string) string {
	schemaBytes, _ := json.MarshalIndent(buildArkStoryboardSchema(), "", "  ")
	return fmt.Sprintf("请将下面的文本整理为章节、场景、分镜和角色结构，并且只返回一个 JSON 对象。JSON 必须严格满足下面这个 schema 的字段结构与必填要求。\n\n额外要求：\n1. characters 数组里只能出现角色名称，例如“李明”“林婉”“神秘男人”。\n2. 不允许把“旧城区雨夜小巷”“夜晚，十二点前”“废弃照相馆门口”这类地点、时间、场景描述写进 characters。\n3. 如果某个场景没有明确人物，可以返回空数组，不要编造地点词充当角色名。\n4. 每个 storyboard 的 visual_description 都必须有值，不能为空，必须写成可以直接拿去生成画面的中文描述。\n5. 如果原文主要是心理、回忆或对话，也要把它转换成可拍摄的画面描述，不要遗漏 visual_description。\n6. shot_type、camera_angle、mood、notes 允许简洁，但 visual_description 绝不能空。\n\nSchema:\n%s\n\n文本内容：\n%s", string(schemaBytes), scriptText)
}

func extractJSONObject(content string) string {
	start := strings.Index(content, "{")
	end := strings.LastIndex(content, "}")
	if start >= 0 && end >= start {
		return strings.TrimSpace(content[start : end+1])
	}
	return content
}

func buildArkStoryboardSchema() map[string]any {
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"chapters", "characters"},
		"properties": map[string]any{
			"chapters": map[string]any{
				"type":  "array",
				"minItems": 1,
				"items": map[string]any{
					"type":                 "object",
					"additionalProperties": false,
					"required":             []string{"title", "summary", "order", "scenes"},
					"properties": map[string]any{
						"title":   map[string]any{"type": "string"},
						"summary": map[string]any{"type": "string"},
						"order":   map[string]any{"type": "integer"},
						"scenes": map[string]any{
							"type":  "array",
							"minItems": 1,
							"items": map[string]any{
								"type":                 "object",
								"additionalProperties": false,
								"required":             []string{"title", "summary", "location", "time_of_day", "order", "characters", "storyboards"},
								"properties": map[string]any{
									"title":       map[string]any{"type": "string"},
									"summary":     map[string]any{"type": "string"},
									"location":    map[string]any{"type": "string"},
									"time_of_day": map[string]any{"type": "string"},
									"order":       map[string]any{"type": "integer"},
									"characters": map[string]any{
										"type":  "array",
										"items": map[string]any{"type": "string"},
									},
									"storyboards": map[string]any{
										"type":  "array",
										"minItems": 1,
										"items": map[string]any{
											"type":                 "object",
											"additionalProperties": false,
											"required": []string{
												"order",
												"shot_number",
												"visual_description",
												"dialogue",
												"duration_seconds",
												"shot_type",
												"camera_angle",
												"mood",
												"notes",
												"characters",
											},
											"properties": map[string]any{
												"order":              map[string]any{"type": "integer"},
												"shot_number":        map[string]any{"type": "integer"},
												"visual_description": map[string]any{"type": "string"},
												"dialogue":           map[string]any{"type": "string"},
												"duration_seconds":   map[string]any{"type": "number"},
												"shot_type":          map[string]any{"type": "string"},
												"camera_angle":       map[string]any{"type": "string"},
												"mood":               map[string]any{"type": "string"},
												"notes":              map[string]any{"type": "string"},
												"characters": map[string]any{
													"type":  "array",
													"items": map[string]any{"type": "string"},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
			"characters": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type":                 "object",
					"additionalProperties": false,
					"required":             []string{"name", "description", "appearance", "tags"},
					"properties": map[string]any{
						"name":        map[string]any{"type": "string"},
						"description": map[string]any{"type": "string"},
						"appearance":  map[string]any{"type": "string"},
						"tags": map[string]any{
							"type":  "array",
							"items": map[string]any{"type": "string"},
						},
					},
				},
			},
		},
	}
}
