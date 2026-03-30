package services

import (
	"log"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
	"storyboard-backend/config"
)

// OSSService wraps Aliyun OSS operations
type OSSService struct {
	client *oss.Client
	bucket *oss.Bucket
	enabled bool
}

// NewOSSService creates a new OSS service
func NewOSSService() *OSSService {
	endpoint := config.GlobalConfig.AliyunOSSEndpoint
	accessKeyID := config.GlobalConfig.AliyunOSSAccessKeyID
	accessKeySecret := config.GlobalConfig.AliyunOSSAccessKeySecret
	bucketName := config.GlobalConfig.AliyunOSSBucket

	if endpoint == "" || accessKeyID == "" || accessKeySecret == "" || bucketName == "" {
		log.Println("OSS not configured, running in local mode")
		return &OSSService{enabled: false}
	}

	client, err := oss.New(endpoint, accessKeyID, accessKeySecret)
	if err != nil {
		log.Printf("Failed to create OSS client: %v", err)
		return &OSSService{enabled: false}
	}

	bucket, err := client.Bucket(bucketName)
	if err != nil {
		log.Printf("Failed to get OSS bucket: %v", err)
		return &OSSService{enabled: false}
	}

	log.Println("OSS service initialized successfully")
	return &OSSService{
		client: client,
		bucket: bucket,
		enabled: true,
	}
}

// IsEnabled returns whether OSS is properly configured
func (s *OSSService) IsEnabled() bool {
	return s.enabled
}

// GetObjectURL gets the public URL of an object
func (s *OSSService) GetObjectURL(objectKey string) string {
	if !s.enabled {
		return ""
	}
	url, err := s.bucket.SignURL(objectKey, oss.HTTPGet, 3600*24*7)
	if err != nil {
		log.Printf("Failed to sign URL: %v", err)
		return ""
	}
	return url
}

// SignUploadURL generates a signed URL for direct upload from client
func (s *OSSService) SignUploadURL(objectKey string, contentType string) (map[string]string, error) {
	if !s.enabled {
		return nil, nil
	}

	// Generate signed URL for PUT upload
	expires := int64(3600) // 1 hour
	url, err := s.bucket.SignURL(objectKey, oss.HTTPPut, expires, oss.ContentType(contentType))
	if err != nil {
		return nil, err
	}

	bucketEndpoint := config.GlobalConfig.AliyunOSSEndpoint
	bucketName := config.GlobalConfig.AliyunOSSBucket
	publicURL := "https://" + bucketName + "." + bucketEndpoint + "/" + objectKey

	return map[string]string{
		"upload_url": url,
		"public_url": publicURL,
		"object_key": objectKey,
	}, nil
}
