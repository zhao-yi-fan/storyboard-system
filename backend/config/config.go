package config

import (
	"log"
	"os"

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
	AliyunOSSEndpoint     string
	AliyunOSSAccessKeyID  string
	AliyunOSSAccessKeySecret string
	AliyunOSSBucket       string
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
	}

	log.Println("Configuration loaded")
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
