package services

import (
	"fmt"
	"io"
	"log"
	"net/url"
	"os"
	"path"
	"strings"
	"sync"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
	"storyboard-backend/config"
)

// OSSService wraps Aliyun OSS operations
type OSSService struct {
	client       *oss.Client
	publicClient *oss.Client
	bucket       *oss.Bucket
	publicBucket *oss.Bucket
	enabled      bool
}

var (
	ossServiceOnce sync.Once
	ossServiceInst *OSSService
)

// NewOSSService creates or returns a singleton OSS service
func NewOSSService() *OSSService {
	ossServiceOnce.Do(func() {
		ossServiceInst = initOSSService()
	})
	return ossServiceInst
}

func initOSSService() *OSSService {
	endpoint := strings.TrimSpace(config.GlobalConfig.AliyunOSSEndpoint)
	publicEndpoint := strings.TrimSpace(config.GlobalConfig.AliyunOSSPublicEndpoint)
	accessKeyID := strings.TrimSpace(config.GlobalConfig.AliyunOSSAccessKeyID)
	accessKeySecret := strings.TrimSpace(config.GlobalConfig.AliyunOSSAccessKeySecret)
	bucketName := strings.TrimSpace(config.GlobalConfig.AliyunOSSBucket)

	if endpoint == "" || accessKeyID == "" || accessKeySecret == "" || bucketName == "" {
		log.Println("OSS not configured, running in local mode")
		return &OSSService{enabled: false}
	}
	if publicEndpoint == "" {
		publicEndpoint = derivePublicOSSEndpoint(endpoint)
	}

	client, err := oss.New(endpoint, accessKeyID, accessKeySecret)
	if err != nil {
		log.Printf("failed to create OSS client: %v", err)
		return &OSSService{enabled: false}
	}
	bucket, err := client.Bucket(bucketName)
	if err != nil {
		log.Printf("failed to get OSS bucket: %v", err)
		return &OSSService{enabled: false}
	}

	publicClient, err := oss.New(publicEndpoint, accessKeyID, accessKeySecret)
	if err != nil {
		log.Printf("failed to create OSS public client: %v", err)
		return &OSSService{enabled: false}
	}
	publicBucket, err := publicClient.Bucket(bucketName)
	if err != nil {
		log.Printf("failed to get OSS public bucket: %v", err)
		return &OSSService{enabled: false}
	}

	log.Println("OSS service initialized successfully")
	return &OSSService{client: client, publicClient: publicClient, bucket: bucket, publicBucket: publicBucket, enabled: true}
}

func derivePublicOSSEndpoint(endpoint string) string {
	trimmed := strings.TrimSpace(endpoint)
	trimmed = strings.TrimPrefix(trimmed, "https://")
	trimmed = strings.TrimPrefix(trimmed, "http://")
	trimmed = strings.Replace(trimmed, "-internal.aliyuncs.com", ".aliyuncs.com", 1)
	return trimmed
}

func (s *OSSService) IsEnabled() bool { return s != nil && s.enabled }

func (s *OSSService) SignObjectURL(objectKey string, expireSeconds int64) string {
	if !s.IsEnabled() {
		return ""
	}
	url, err := s.publicBucket.SignURL(strings.TrimPrefix(objectKey, "/"), oss.HTTPGet, expireSeconds)
	if err != nil {
		log.Printf("failed to sign object URL: %v", err)
		return ""
	}
	return normalizeSignedObjectURL(url)
}

func (s *OSSService) ResolveGeneratedURL(raw string) string {
	if !s.IsEnabled() || !IsGeneratedAssetPath(raw) {
		return raw
	}
	objectKey, err := GeneratedObjectKey(raw)
	if err != nil {
		return raw
	}
	resolved := s.SignObjectURL(objectKey, 3600)
	if resolved == "" {
		return raw
	}
	return resolved
}

func (s *OSSService) ResolveURL(raw, publicBaseURL string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	if IsGeneratedAssetPath(trimmed) {
		return s.ResolveGeneratedURL(trimmed)
	}
	if strings.HasPrefix(trimmed, "http://") || strings.HasPrefix(trimmed, "https://") {
		return trimmed
	}
	if strings.HasPrefix(trimmed, "/") && strings.TrimSpace(publicBaseURL) != "" {
		return strings.TrimRight(strings.TrimSpace(publicBaseURL), "/") + trimmed
	}
	return trimmed
}

func (s *OSSService) SignUploadURL(objectKey string, contentType string) (map[string]string, error) {
	if !s.IsEnabled() {
		return nil, nil
	}
	cleanedKey := strings.TrimPrefix(path.Clean("/"+strings.TrimSpace(objectKey)), "/")
	url, err := s.publicBucket.SignURL(cleanedKey, oss.HTTPPut, 3600, oss.ContentType(contentType))
	if err != nil {
		return nil, err
	}
	return map[string]string{
		"upload_url": normalizeSignedObjectURL(url),
		"public_url": GeneratedPublicPathFromObjectKey(cleanedKey),
		"object_key": cleanedKey,
	}, nil
}

func (s *OSSService) UploadFile(localPath, objectKey string) error {
	if !s.IsEnabled() {
		return fmt.Errorf("oss not configured")
	}
	cleanedKey := strings.TrimPrefix(path.Clean("/"+strings.TrimSpace(objectKey)), "/")
	return s.bucket.PutObjectFromFile(cleanedKey, localPath)
}

func (s *OSSService) UploadReader(objectKey string, reader io.Reader, options ...oss.Option) error {
	if !s.IsEnabled() {
		return fmt.Errorf("oss not configured")
	}
	cleanedKey := strings.TrimPrefix(path.Clean("/"+strings.TrimSpace(objectKey)), "/")
	return s.bucket.PutObject(cleanedKey, reader, options...)
}

func (s *OSSService) OpenObject(objectKey string) (io.ReadCloser, error) {
	if !s.IsEnabled() {
		return nil, fmt.Errorf("oss not configured")
	}
	return s.bucket.GetObject(strings.TrimPrefix(objectKey, "/"))
}

func (s *OSSService) OpenGenerated(generatedPath string) (io.ReadCloser, error) {
	objectKey, err := GeneratedObjectKey(generatedPath)
	if err != nil {
		return nil, err
	}
	return s.OpenObject(objectKey)
}

func (s *OSSService) DownloadGeneratedToFile(generatedPath, localPath string) error {
	reader, err := s.OpenGenerated(generatedPath)
	if err != nil {
		return err
	}
	defer reader.Close()

	file, err := os.Create(localPath)
	if err != nil {
		return err
	}
	defer file.Close()
	_, err = io.Copy(file, reader)
	return err
}

func (s *OSSService) ObjectExists(objectKey string) (bool, error) {
	if !s.IsEnabled() {
		return false, fmt.Errorf("oss not configured")
	}
	return s.bucket.IsObjectExist(strings.TrimPrefix(objectKey, "/"))
}

func (s *OSSService) DeleteObject(objectKey string) error {
	if !s.IsEnabled() {
		return nil
	}
	return s.bucket.DeleteObject(strings.TrimPrefix(objectKey, "/"))
}

func (s *OSSService) EnsureUploaded(localPath, generatedPath string) error {
	objectKey, err := GeneratedObjectKey(generatedPath)
	if err != nil {
		return err
	}
	return s.UploadFile(localPath, objectKey)
}

func (s *OSSService) PublicObjectURL(objectKey string) string {
	if !s.IsEnabled() {
		return ""
	}
	endpoint := derivePublicOSSEndpoint(config.GlobalConfig.AliyunOSSPublicEndpoint)
	if endpoint == "" {
		endpoint = derivePublicOSSEndpoint(config.GlobalConfig.AliyunOSSEndpoint)
	}
	bucketName := strings.TrimSpace(config.GlobalConfig.AliyunOSSBucket)
	return (&url.URL{Scheme: "https", Host: bucketName + "." + endpoint, Path: "/" + strings.TrimPrefix(objectKey, "/")}).String()
}

func normalizeSignedObjectURL(raw string) string {
	normalized := strings.ReplaceAll(raw, "%2F", "/")
	normalized = strings.ReplaceAll(normalized, "%2f", "/")
	return normalized
}
