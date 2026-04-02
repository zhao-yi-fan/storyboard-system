package config

import (
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// Config holds all configuration
type Config struct {
	DBHost         string
	DBPort         string
	DBUser         string
	DBPassword     string
	DBName         string
	ServerPort     string
	AliyunOSSEndpoint         string
	AliyunOSSAccessKeyID      string
	AliyunOSSAccessKeySecret string
	AliyunOSSBucket           string
	ArkAPIKey                 string
	ArkBaseURL                string
	ArkModel                  string
	ArkRequestTimeoutSeconds  int
}

var GlobalConfig Config

// Load loads configuration from environment variables
func Load() {
	// Load .env file if it exists
	godotenv.Load()

	GlobalConfig = Config{
		DBHost:                 getEnv("DB_HOST", "localhost"),
		DBPort:                 getEnv("DB_PORT", "3306"),
		DBUser:                 getEnv("DB_USER", "root"),
		DBPassword:             getEnv("DB_PASSWORD", ""),
		DBName:                 getEnv("DB_NAME", "storyboard"),
		ServerPort:             getEnv("SERVER_PORT", "8082"),
		AliyunOSSEndpoint:       getEnv("ALIYUN_OSS_ENDPOINT", ""),
		AliyunOSSAccessKeyID:    getEnv("ALIYUN_OSS_ACCESS_KEY_ID", ""),
		AliyunOSSAccessKeySecret: getEnv("ALIYUN_OSS_ACCESS_KEY_SECRET", ""),
		AliyunOSSBucket:         getEnv("ALIYUN_OSS_BUCKET", ""),
		ArkAPIKey:               getEnv("ARK_API_KEY", ""),
		ArkBaseURL:              getEnv("ARK_BASE_URL", ""),
		ArkModel:                getEnv("ARK_MODEL", ""),
		ArkRequestTimeoutSeconds: getEnvInt("ARK_REQUEST_TIMEOUT_SECONDS", 60),
	}

	log.Println("Configuration loaded")
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

func (c Config) ValidateArkConfig() error {
	switch {
	case c.ArkAPIKey == "":
		return fmt.Errorf("Ark 解析未配置：缺少 ARK_API_KEY")
	case c.ArkBaseURL == "":
		return fmt.Errorf("Ark 解析未配置：缺少 ARK_BASE_URL")
	case c.ArkModel == "":
		return fmt.Errorf("Ark 解析未配置：缺少 ARK_MODEL")
	default:
		return nil
	}
}
