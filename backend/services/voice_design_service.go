package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"storyboard-backend/config"
	"storyboard-backend/models"
)

type VoiceDesignService struct {
	httpClient *http.Client
	ossService *OSSService
}

type VoiceDesignResult struct {
	VoiceReferenceURL      string
	VoiceReferenceDuration float64
	VoiceReferenceText     string
	VoiceName              string
	VoicePrompt            string
}

type dashScopeVoiceDesignRequest struct {
	Model      string                         `json:"model"`
	Input      dashScopeVoiceDesignInput      `json:"input"`
	Parameters dashScopeVoiceDesignParameters `json:"parameters"`
}

type dashScopeVoiceDesignInput struct {
	Action        string `json:"action"`
	TargetModel   string `json:"target_model"`
	VoicePrompt   string `json:"voice_prompt"`
	PreviewText   string `json:"preview_text"`
	PreferredName string `json:"preferred_name"`
	Language      string `json:"language"`
}

type dashScopeVoiceDesignParameters struct {
	SampleRate     int    `json:"sample_rate"`
	ResponseFormat string `json:"response_format"`
}

type dashScopeVoiceDesignResponse struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	RequestID string `json:"request_id"`
	Output    struct {
		Voice        string `json:"voice"`
		TargetModel  string `json:"target_model"`
		PreviewAudio struct {
			Data           string `json:"data"`
			SampleRate     int    `json:"sample_rate"`
			ResponseFormat string `json:"response_format"`
		} `json:"preview_audio"`
	} `json:"output"`
}

func NewVoiceDesignService() *VoiceDesignService {
	timeout := time.Duration(config.GlobalConfig.DashScopeVoiceRequestTimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 120 * time.Second
	}
	return &VoiceDesignService{
		httpClient: &http.Client{Timeout: timeout},
		ossService: NewOSSService(),
	}
}

func (s *VoiceDesignService) GenerateCharacterVoiceReference(ctx context.Context, character *models.Character, customPrompt, customText string) (*VoiceDesignResult, error) {
	if character == nil {
		return nil, fmt.Errorf("角色不存在")
	}
	if err := config.GlobalConfig.ValidateDashScopeVoiceConfig(); err != nil {
		return nil, err
	}

	voicePrompt := strings.TrimSpace(customPrompt)
	if voicePrompt == "" {
		voicePrompt = buildCharacterVoicePrompt(character)
	}
	previewText := strings.TrimSpace(customText)
	if previewText == "" {
		previewText = buildCharacterVoiceReferenceText(character)
	}

	reqBody := dashScopeVoiceDesignRequest{
		Model: config.GlobalConfig.DashScopeVoiceDesignModel,
		Input: dashScopeVoiceDesignInput{
			Action:        "create",
			TargetModel:   config.GlobalConfig.DashScopeVoiceTargetModel,
			VoicePrompt:   voicePrompt,
			PreviewText:   previewText,
			PreferredName: preferredVoiceName(character),
			Language:      "zh",
		},
		Parameters: dashScopeVoiceDesignParameters{
			SampleRate:     24000,
			ResponseFormat: "wav",
		},
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(config.GlobalConfig.DashScopeVoiceBaseURL, "/")+"/services/audio/tts/customization", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+config.GlobalConfig.DashScopeAPIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("调用主语音参考生成失败: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var parsed dashScopeVoiceDesignResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return nil, fmt.Errorf("解析主语音参考响应失败: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if strings.TrimSpace(parsed.Message) != "" {
			return nil, fmt.Errorf("生成主语音参考失败: %s", parsed.Message)
		}
		return nil, fmt.Errorf("生成主语音参考失败: HTTP %d", resp.StatusCode)
	}
	if strings.TrimSpace(parsed.Code) != "" {
		return nil, fmt.Errorf("生成主语音参考失败: %s", strings.TrimSpace(parsed.Message))
	}
	if strings.TrimSpace(parsed.Output.Voice) == "" || strings.TrimSpace(parsed.Output.PreviewAudio.Data) == "" {
		return nil, fmt.Errorf("生成主语音参考失败: 返回结果缺少音色或音频数据")
	}

	audioBytes, err := base64.StdEncoding.DecodeString(parsed.Output.PreviewAudio.Data)
	if err != nil {
		return nil, fmt.Errorf("解码主语音参考音频失败: %w", err)
	}
	responseFormat := normalizeVoiceResponseFormat(parsed.Output.PreviewAudio.ResponseFormat)
	duration := 0.0
	if responseFormat == "wav" {
		if parsedDuration, parseErr := wavDurationSeconds(audioBytes); parseErr != nil {
			log.Printf("[voice-design] wav duration parse skipped: %v", parseErr)
		} else {
			duration = parsedDuration
		}
	}

	publicPath, err := s.storeVoiceReference(audioBytes, fmt.Sprintf("character-voice-reference-%d-%d.%s", character.ID, time.Now().Unix(), voiceFileExtension(responseFormat)))
	if err != nil {
		return nil, err
	}

	return &VoiceDesignResult{
		VoiceReferenceURL:      publicPath,
		VoiceReferenceDuration: duration,
		VoiceReferenceText:     previewText,
		VoiceName:              strings.TrimSpace(parsed.Output.Voice),
		VoicePrompt:            voicePrompt,
	}, nil
}

func (s *VoiceDesignService) storeVoiceReference(audioBytes []byte, filename string) (string, error) {
	publicPath := GeneratedPublicPath("characters", filename)
	if s.ossService.IsEnabled() {
		objectKey, err := GeneratedObjectKey(publicPath)
		if err != nil {
			return "", err
		}
		if err := s.ossService.UploadReader(objectKey, bytes.NewReader(audioBytes)); err != nil {
			return "", fmt.Errorf("上传主语音参考到 OSS 失败: %w", err)
		}
		return publicPath, nil
	}

	assetRoot, err := resolveGeneratedAssetRoot()
	if err != nil {
		return "", err
	}
	outputDir := filepath.Join(assetRoot, "characters")
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		return "", fmt.Errorf("创建角色语音目录失败: %w", err)
	}
	if err := os.WriteFile(filepath.Join(outputDir, filename), audioBytes, 0o644); err != nil {
		return "", fmt.Errorf("保存角色语音文件失败: %w", err)
	}
	return publicPath, nil
}

func preferredVoiceName(character *models.Character) string {
	base := sanitizeVoiceToken(character.Name)
	if base == "" {
		base = "character"
	}
	if len(base) > 12 {
		base = base[:12]
	}
	return fmt.Sprintf("%s_%d", base, character.ID)
}

func sanitizeVoiceToken(value string) string {
	cleaned := strings.ToLower(strings.TrimSpace(value))
	re := regexp.MustCompile(`[^a-z0-9_]+`)
	cleaned = re.ReplaceAllString(cleaned, "_")
	cleaned = strings.Trim(cleaned, "_")
	return cleaned
}

func buildCharacterVoicePrompt(character *models.Character) string {
	var b strings.Builder
	b.WriteString("为漫剧角色设计一段稳定可复用的中文主语音。")
	if strings.TrimSpace(character.Name) != "" {
		b.WriteString(" 角色名：")
		b.WriteString(strings.TrimSpace(character.Name))
		b.WriteString("。")
	}
	if strings.TrimSpace(character.Description) != "" {
		b.WriteString(" 人设描述：")
		b.WriteString(strings.TrimSpace(character.Description))
		b.WriteString("。")
	}
	b.WriteString(" 声音要求：自然真人感，吐字清晰，适合剧情对白。")
	b.WriteString(" 说话状态：克制、真实，不要主持腔，不要广告腔。")
	return b.String()
}

func buildCharacterVoiceReferenceText(character *models.Character) string {
	name := strings.TrimSpace(character.Name)
	if name == "" {
		name = "我"
	}
	return fmt.Sprintf("我叫%s。过去很多选择让我失去了方向，但这一次，我想亲手改写自己的命运。", name)
}

func normalizeVoiceResponseFormat(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "wav", "mp3", "opus", "pcm":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "wav"
	}
}

func voiceFileExtension(format string) string {
	switch normalizeVoiceResponseFormat(format) {
	case "pcm":
		return "pcm"
	case "mp3":
		return "mp3"
	case "opus":
		return "opus"
	default:
		return "wav"
	}
}

func wavDurationSeconds(audioBytes []byte) (float64, error) {
	if len(audioBytes) < 44 || string(audioBytes[0:4]) != "RIFF" || string(audioBytes[8:12]) != "WAVE" {
		return 0, fmt.Errorf("不是有效的 wav 文件")
	}
	var sampleRate uint32
	var byteRate uint32
	var dataSize uint32
	offset := 12
	for offset+8 <= len(audioBytes) {
		chunkID := string(audioBytes[offset : offset+4])
		chunkSize := int(binary.LittleEndian.Uint32(audioBytes[offset+4 : offset+8]))
		offset += 8
		if offset+chunkSize > len(audioBytes) {
			break
		}
		switch chunkID {
		case "fmt ":
			if chunkSize >= 16 {
				sampleRate = binary.LittleEndian.Uint32(audioBytes[offset+4 : offset+8])
				byteRate = binary.LittleEndian.Uint32(audioBytes[offset+8 : offset+12])
			}
		case "data":
			dataSize = uint32(chunkSize)
		}
		offset += chunkSize
		if chunkSize%2 == 1 {
			offset++
		}
	}
	if byteRate == 0 {
		return 0, fmt.Errorf("无法解析 wav byte rate")
	}
	if sampleRate == 0 || dataSize == 0 {
		return 0, fmt.Errorf("无法解析 wav 数据区")
	}
	return float64(dataSize) / float64(byteRate), nil
}
