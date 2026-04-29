package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds all configuration
type Config struct {
	DBHost                              string
	DBPort                              string
	DBUser                              string
	DBPassword                          string
	DBName                              string
	ServerPort                          string
	AliyunOSSEndpoint                   string
	AliyunOSSPublicEndpoint             string
	AliyunOSSAccessKeyID                string
	AliyunOSSAccessKeySecret            string
	AliyunOSSBucket                     string
	DeepSeekAPIKey                      string
	DeepSeekBaseURL                     string
	DeepSeekModel                       string
	DeepSeekRequestTimeoutSeconds       int
	DashScopeAPIKey                     string
	DashScopeVoiceBaseURL               string
	DashScopeVoiceDesignModel           string
	DashScopeVoiceTargetModel           string
	DashScopeVoiceRequestTimeoutSeconds int
	WanxBaseURL                         string
	WanxModel                           string
	WanxReferenceModel                  string
	WanxRequestTimeoutSeconds           int
	WanxVideoBaseURL                    string
	WanxVideoModel                      string
	WanxVideoRequestTimeoutSeconds      int
	SeedanceAPIKey                      string
	SeedanceBaseURL                     string
	SeedanceModel                       string
	SeedanceRequestTimeoutSeconds       int
	SeedreamImageAPIKey                 string
	SeedreamImageBaseURL                string
	SeedreamImageModel                  string
	SeedreamImageTimeoutSeconds         int
	OpenAIAPIKey                        string
	OpenAIImageBaseURL                  string
	OpenAIImageModel                    string
	OpenAIImageTimeoutSeconds           int
	PublicAppBaseURL                    string
	GeneratedAssetDir                   string
	GeneratedAssetBasePath              string
}

var GlobalConfig Config

// Load loads configuration from environment variables
func Load() {
	godotenv.Load()

	GlobalConfig = Config{
		DBHost:                              getEnv("DB_HOST", "localhost"),
		DBPort:                              getEnv("DB_PORT", "3306"),
		DBUser:                              getEnv("DB_USER", "root"),
		DBPassword:                          getEnv("DB_PASSWORD", ""),
		DBName:                              getEnv("DB_NAME", "storyboard"),
		ServerPort:                          getEnv("SERVER_PORT", "8082"),
		AliyunOSSEndpoint:                   getEnv("ALIYUN_OSS_ENDPOINT", ""),
		AliyunOSSPublicEndpoint:             getEnv("ALIYUN_OSS_PUBLIC_ENDPOINT", ""),
		AliyunOSSAccessKeyID:                getEnv("ALIYUN_OSS_ACCESS_KEY_ID", ""),
		AliyunOSSAccessKeySecret:            getEnv("ALIYUN_OSS_ACCESS_KEY_SECRET", ""),
		AliyunOSSBucket:                     getEnv("ALIYUN_OSS_BUCKET", ""),
		DeepSeekAPIKey:                      getEnv("DEEPSEEK_API_KEY", ""),
		DeepSeekBaseURL:                     getEnv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
		DeepSeekModel:                       getEnv("DEEPSEEK_MODEL", "deepseek-v4-flash"),
		DeepSeekRequestTimeoutSeconds:       getEnvInt("DEEPSEEK_REQUEST_TIMEOUT_SECONDS", 180),
		DashScopeAPIKey:                     getEnv("DASHSCOPE_API_KEY", ""),
		DashScopeVoiceBaseURL:               getEnv("DASHSCOPE_VOICE_BASE_URL", "https://dashscope.aliyuncs.com/api/v1"),
		DashScopeVoiceDesignModel:           getEnv("DASHSCOPE_VOICE_DESIGN_MODEL", "qwen-voice-design"),
		DashScopeVoiceTargetModel:           getEnv("DASHSCOPE_VOICE_TARGET_MODEL", "qwen3-tts-vd-2026-01-26"),
		DashScopeVoiceRequestTimeoutSeconds: getEnvInt("DASHSCOPE_VOICE_REQUEST_TIMEOUT_SECONDS", 120),
		WanxBaseURL:                         getEnv("WANX_BASE_URL", "https://dashscope.aliyuncs.com/api/v1"),
		WanxModel:                           getEnv("WANX_MODEL", "wanx2.0-t2i-turbo"),
		WanxReferenceModel:                  getEnv("WANX_REFERENCE_MODEL", "wan2.7-image-pro"),
		WanxRequestTimeoutSeconds:           getEnvInt("WANX_REQUEST_TIMEOUT_SECONDS", 300),
		WanxVideoBaseURL:                    getEnv("WANX_VIDEO_BASE_URL", "https://dashscope.aliyuncs.com/api/v1"),
		WanxVideoModel:                      getEnv("WANX_VIDEO_MODEL", "wan2.7-i2v"),
		WanxVideoRequestTimeoutSeconds:      getEnvInt("WANX_VIDEO_REQUEST_TIMEOUT_SECONDS", 300),
		SeedanceAPIKey:                      getEnv("SEEDANCE_API_KEY", getEnv("ARK_API_KEY", "")),
		SeedanceBaseURL:                     getEnv("SEEDANCE_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3"),
		SeedanceModel:                       getEnv("SEEDANCE_MODEL", "doubao-seedance-1-5-pro-251215"),
		SeedanceRequestTimeoutSeconds:       getEnvInt("SEEDANCE_REQUEST_TIMEOUT_SECONDS", 300),
		SeedreamImageAPIKey:                 getEnv("SEEDREAM_IMAGE_API_KEY", getEnv("ARK_API_KEY", "")),
		SeedreamImageBaseURL:                getEnv("SEEDREAM_IMAGE_BASE_URL", getEnv("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3")),
		SeedreamImageModel:                  getEnv("SEEDREAM_IMAGE_MODEL", "doubao-seedream-4-5-251128"),
		SeedreamImageTimeoutSeconds:         getEnvInt("SEEDREAM_IMAGE_TIMEOUT_SECONDS", 180),
		OpenAIAPIKey:                        getEnv("OPENAI_API_KEY", ""),
		OpenAIImageBaseURL:                  getEnv("OPENAI_IMAGE_BASE_URL", "https://api.openai.com/v1"),
		OpenAIImageModel:                    getEnv("OPENAI_IMAGE_MODEL", "gpt-image-2"),
		OpenAIImageTimeoutSeconds:           getEnvInt("OPENAI_IMAGE_TIMEOUT_SECONDS", 180),
		PublicAppBaseURL:                    getEnv("PUBLIC_APP_BASE_URL", ""),
		GeneratedAssetDir:                   getEnv("GENERATED_ASSET_DIR", "../storage"),
		GeneratedAssetBasePath:              getEnv("GENERATED_ASSET_BASE_PATH", "/generated"),
	}

	log.Println("Configuration loaded")
}

func (c Config) ValidateDashScopeVoiceConfig() error {
	switch {
	case c.DashScopeAPIKey == "":
		return fmt.Errorf("角色主语音参考生成未配置：缺少 DASHSCOPE_API_KEY")
	case c.DashScopeVoiceBaseURL == "":
		return fmt.Errorf("角色主语音参考生成未配置：缺少 DASHSCOPE_VOICE_BASE_URL")
	case c.DashScopeVoiceDesignModel == "":
		return fmt.Errorf("角色主语音参考生成未配置：缺少 DASHSCOPE_VOICE_DESIGN_MODEL")
	case c.DashScopeVoiceTargetModel == "":
		return fmt.Errorf("角色主语音参考生成未配置：缺少 DASHSCOPE_VOICE_TARGET_MODEL")
	default:
		return nil
	}
}

func (c Config) ValidateWanxVideoConfig() error {
	switch {
	case c.DashScopeAPIKey == "":
		return fmt.Errorf("镜头视频生成未配置：缺少 DASHSCOPE_API_KEY")
	case c.WanxVideoBaseURL == "":
		return fmt.Errorf("镜头视频生成未配置：缺少 WANX_VIDEO_BASE_URL")
	case c.WanxVideoModel == "":
		return fmt.Errorf("镜头视频生成未配置：缺少 WANX_VIDEO_MODEL")
	default:
		return nil
	}
}

func (c Config) ValidateSeedanceVideoConfig() error {
	switch {
	case c.SeedanceAPIKey == "":
		return fmt.Errorf("镜头视频生成未配置：缺少 SEEDANCE_API_KEY")
	case c.SeedanceBaseURL == "":
		return fmt.Errorf("镜头视频生成未配置：缺少 SEEDANCE_BASE_URL")
	case c.SeedanceModel == "":
		return fmt.Errorf("镜头视频生成未配置：缺少 SEEDANCE_MODEL")
	default:
		return nil
	}
}

func (c Config) ValidateOpenAIImageConfig() error {
	switch {
	case c.OpenAIAPIKey == "":
		return fmt.Errorf("GPT Image 2 未配置：缺少 OPENAI_API_KEY")
	case c.OpenAIImageBaseURL == "":
		return fmt.Errorf("GPT Image 2 未配置：缺少 OPENAI_IMAGE_BASE_URL")
	case c.OpenAIImageModel == "":
		return fmt.Errorf("GPT Image 2 未配置：缺少 OPENAI_IMAGE_MODEL")
	default:
		return nil
	}
}

func (c Config) ValidateSeedreamImageConfig() error {
	switch {
	case c.SeedreamImageAPIKey == "":
		return fmt.Errorf("Seedream 4.5 未配置：缺少 SEEDREAM_IMAGE_API_KEY")
	case c.SeedreamImageBaseURL == "":
		return fmt.Errorf("Seedream 4.5 未配置：缺少 SEEDREAM_IMAGE_BASE_URL")
	case c.SeedreamImageModel == "":
		return fmt.Errorf("Seedream 4.5 未配置：缺少 SEEDREAM_IMAGE_MODEL")
	default:
		return nil
	}
}

var SupportedVideoModels = map[string]struct{}{
	"wan2.6-i2v-flash": {},
	"wan2.7-i2v":       {},
	"seedance-1.5-pro": {},
}

var SupportedCoverModels = map[string]struct{}{
	"":                 {},
	"auto":             {},
	"qwen-image-2.0":   {},
	"wan2.7-image-pro": {},
	"seedream-4.5":     {},
}

func IsSupportedVideoModel(model string) bool {
	_, ok := SupportedVideoModels[model]
	return ok
}

func IsSeedanceVideoModel(model string) bool {
	return strings.HasPrefix(strings.TrimSpace(model), "seedance")
}

func IsSupportedCoverModel(model string) bool {
	_, ok := SupportedCoverModels[strings.TrimSpace(model)]
	return ok
}

func (c Config) ValidateWanxConfig() error {
	switch {
	case c.DashScopeAPIKey == "":
		return fmt.Errorf("场景封面生成未配置：缺少 DASHSCOPE_API_KEY")
	case c.WanxBaseURL == "":
		return fmt.Errorf("场景封面生成未配置：缺少 WANX_BASE_URL")
	case c.WanxModel == "":
		return fmt.Errorf("场景封面生成未配置：缺少 WANX_MODEL")
	default:
		return nil
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		log.Printf("Invalid integer for %s: %s, using default %d", key, value, defaultValue)
		return defaultValue
	}
	return parsed
}

func (c Config) ValidateDeepSeekConfig() error {
	switch {
	case c.DeepSeekAPIKey == "":
		return fmt.Errorf("DeepSeek 解析未配置：缺少 DEEPSEEK_API_KEY")
	case c.DeepSeekBaseURL == "":
		return fmt.Errorf("DeepSeek 解析未配置：缺少 DEEPSEEK_BASE_URL")
	case c.DeepSeekModel == "":
		return fmt.Errorf("DeepSeek 解析未配置：缺少 DEEPSEEK_MODEL")
	default:
		return nil
	}
}
