package services

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"storyboard-backend/config"
	"storyboard-backend/models"
	"storyboard-backend/repository"
)

const (
	sceneVideoPreviewHeight = 480
	sceneVideoFPS           = 24
	sceneVideoWidth         = 1280
	sceneVideoHeight        = 720
)

type SceneVideoService struct {
	sceneRepo      *repository.SceneRepository
	storyboardRepo *repository.StoryboardRepository
	ossService     *OSSService
}

func NewSceneVideoService() (*SceneVideoService, error) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		return nil, fmt.Errorf("服务器缺少 ffmpeg，无法合成场景视频")
	}
	return &SceneVideoService{
		sceneRepo:      &repository.SceneRepository{},
		storyboardRepo: &repository.StoryboardRepository{},
		ossService:     NewOSSService(),
	}, nil
}

func (s *SceneVideoService) ComposeAndAttach(sceneID int64, regenerate bool) (*models.Scene, error) {
	scene, err := s.sceneRepo.FindByID(sceneID)
	if err != nil {
		return nil, err
	}
	if scene == nil {
		return nil, fmt.Errorf("scene not found")
	}
	if !regenerate && strings.TrimSpace(scene.VideoURL) != "" {
		return scene, nil
	}

	storyboards, err := s.storyboardRepo.FindBySceneID(sceneID)
	if err != nil {
		return nil, err
	}
	inputs := collectSceneVideoInputs(storyboards)
	if len(inputs) == 0 {
		return nil, fmt.Errorf("当前场景没有可合成的视频镜头")
	}

	scene.VideoStatus = "generating"
	scene.VideoError = ""
	if err := s.sceneRepo.Update(scene); err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(config.GlobalConfig.WanxVideoRequestTimeoutSeconds)*time.Second)
	defer cancel()

	videoURL, previewURL, duration, err := s.composeSceneVideoFiles(ctx, scene.ID, inputs)
	if err != nil {
		scene.VideoStatus = "failed"
		scene.VideoError = err.Error()
		_ = s.sceneRepo.Update(scene)
		return nil, err
	}

	scene.VideoURL = videoURL
	scene.VideoPreviewURL = previewURL
	scene.VideoStatus = "succeeded"
	scene.VideoError = ""
	scene.VideoDuration = duration
	if err := s.sceneRepo.Update(scene); err != nil {
		return nil, err
	}
	return s.sceneRepo.FindByID(sceneID)
}

type sceneVideoInput struct {
	storyboardID int64
	source       string
	duration     float64
	sortOrder    int
	shotNumber   int
}

func collectSceneVideoInputs(storyboards []models.Storyboard) []sceneVideoInput {
	inputs := make([]sceneVideoInput, 0, len(storyboards))
	for _, storyboard := range storyboards {
		if strings.TrimSpace(storyboard.VideoURL) == "" || storyboard.VideoStatus != "succeeded" {
			continue
		}
		duration := storyboard.VideoDuration
		if duration <= 0 {
			duration = storyboard.Duration
		}
		inputs = append(inputs, sceneVideoInput{
			storyboardID: storyboard.ID,
			source:       strings.TrimSpace(storyboard.VideoURL),
			duration:     duration,
			sortOrder:    storyboard.SortOrder,
			shotNumber:   storyboard.ShotNumber,
		})
	}
	sort.SliceStable(inputs, func(i, j int) bool {
		if inputs[i].sortOrder == inputs[j].sortOrder {
			return inputs[i].shotNumber < inputs[j].shotNumber
		}
		return inputs[i].sortOrder < inputs[j].sortOrder
	})
	return inputs
}

func (s *SceneVideoService) composeSceneVideoFiles(ctx context.Context, sceneID int64, inputs []sceneVideoInput) (string, string, float64, error) {
	workDir, err := os.MkdirTemp("", fmt.Sprintf("scene-%d-compose-*", sceneID))
	if err != nil {
		return "", "", 0, fmt.Errorf("创建场景视频临时目录失败: %w", err)
	}
	defer os.RemoveAll(workDir)

	transcodedPaths := make([]string, 0, len(inputs))
	totalDuration := 0.0
	for idx, input := range inputs {
		materializedPath := filepath.Join(workDir, fmt.Sprintf("input-shot-%03d.mp4", idx+1))
		if err := s.materializeInput(input.source, materializedPath); err != nil {
			return "", "", 0, err
		}
		tempPath := filepath.Join(workDir, fmt.Sprintf("temp-shot-%03d.mp4", idx+1))
		if err := transcodeSceneInput(ctx, materializedPath, tempPath); err != nil {
			return "", "", 0, err
		}
		transcodedPaths = append(transcodedPaths, tempPath)
		totalDuration += input.duration
	}

	inputsFile := filepath.Join(workDir, "inputs.txt")
	if err := writeConcatInputs(inputsFile, transcodedPaths); err != nil {
		return "", "", 0, err
	}

	filename := fmt.Sprintf("scene-%d-%d.mp4", sceneID, time.Now().Unix())
	finalPath := filepath.Join(workDir, filename)
	if err := concatSceneVideos(ctx, inputsFile, finalPath); err != nil {
		return "", "", 0, err
	}

	publicPath := GeneratedPublicPath("scene-videos", filename)
	if s.ossService.IsEnabled() {
		if err := s.ossService.EnsureUploaded(finalPath, publicPath); err != nil {
			return "", "", 0, fmt.Errorf("上传场景视频到 OSS 失败: %w", err)
		}
		return publicPath, publicPath, totalDuration, nil
	}

	assetRoot, err := resolveGeneratedAssetRoot()
	if err != nil {
		return "", "", 0, err
	}
	sceneVideosDir := filepath.Join(assetRoot, "scene-videos")
	if err := os.MkdirAll(sceneVideosDir, 0o755); err != nil {
		return "", "", 0, fmt.Errorf("创建场景视频目录失败: %w", err)
	}
	if err := os.Rename(finalPath, filepath.Join(sceneVideosDir, filename)); err != nil {
		return "", "", 0, err
	}
	return publicPath, publicPath, totalDuration, nil
}

func (s *SceneVideoService) materializeInput(source, outputPath string) error {
	if s.ossService.IsEnabled() && IsGeneratedAssetPath(source) {
		return s.ossService.DownloadGeneratedToFile(source, outputPath)
	}
	if IsGeneratedAssetPath(source) {
		objectKey, err := GeneratedObjectKey(source)
		if err != nil {
			return err
		}
		localPath, err := generatedObjectKeyToLocalPath(objectKey)
		if err != nil {
			return err
		}
		input, err := os.Open(localPath)
		if err != nil {
			return err
		}
		defer input.Close()
		output, err := os.Create(outputPath)
		if err != nil {
			return err
		}
		defer output.Close()
		_, err = io.Copy(output, input)
		return err
	}
	return fmt.Errorf("unsupported scene video input: %s", source)
}

func transcodeSceneInput(ctx context.Context, inputPath, outputPath string) error {
	cmd := exec.CommandContext(
		ctx,
		"ffmpeg",
		"-y",
		"-i", inputPath,
		"-vf", fmt.Sprintf("scale=%d:%d:force_original_aspect_ratio=decrease,pad=%d:%d:(ow-iw)/2:(oh-ih)/2:black,fps=%d", sceneVideoWidth, sceneVideoHeight, sceneVideoWidth, sceneVideoHeight, sceneVideoFPS),
		"-c:v", "libx264",
		"-preset", "veryfast",
		"-crf", "28",
		"-c:a", "aac",
		"-b:a", "128k",
		"-ar", "48000",
		outputPath,
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("镜头视频转码失败: %v: %s", err, strings.TrimSpace(string(output)))
	}
	return nil
}

func writeConcatInputs(path string, inputs []string) error {
	lines := make([]string, 0, len(inputs))
	for _, input := range inputs {
		escaped := strings.ReplaceAll(input, "'", `'\\''`)
		lines = append(lines, fmt.Sprintf("file '%s'", escaped))
	}
	return os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0o644)
}

func concatSceneVideos(ctx context.Context, inputsFile, outputPath string) error {
	cmd := exec.CommandContext(
		ctx,
		"ffmpeg",
		"-y",
		"-f", "concat",
		"-safe", "0",
		"-i", inputsFile,
		"-c:v", "libx264",
		"-preset", "veryfast",
		"-crf", "23",
		"-c:a", "aac",
		"-b:a", "160k",
		"-movflags", "+faststart",
		outputPath,
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("场景视频合成失败: %v: %s", err, strings.TrimSpace(string(output)))
	}
	return nil
}
