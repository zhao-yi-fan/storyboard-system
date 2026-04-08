package services

import (
	"context"
	"fmt"
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

type ProjectVideoService struct {
	projectRepo *repository.ProjectRepository
	chapterRepo *repository.ChapterRepository
	sceneRepo   *repository.SceneRepository
}

type projectVideoInput struct {
	sceneID    int64
	path       string
	duration   float64
	chapterOrd int
	sceneOrd   int
}

func NewProjectVideoService() (*ProjectVideoService, error) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		return nil, fmt.Errorf("服务器缺少 ffmpeg，无法合成项目总片")
	}
	return &ProjectVideoService{
		projectRepo: &repository.ProjectRepository{},
		chapterRepo: &repository.ChapterRepository{},
		sceneRepo:   &repository.SceneRepository{},
	}, nil
}

func (s *ProjectVideoService) ComposeAndAttach(projectID int64, regenerate bool) (*models.Project, error) {
	project, err := s.projectRepo.FindByID(projectID)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, fmt.Errorf("project not found")
	}
	if !regenerate && strings.TrimSpace(project.VideoURL) != "" {
		return project, nil
	}

	chapters, err := s.chapterRepo.FindByProjectID(projectID)
	if err != nil {
		return nil, err
	}
	inputs, err := s.collectProjectVideoInputs(chapters)
	if err != nil {
		return nil, err
	}
	if len(inputs) == 0 {
		return nil, fmt.Errorf("当前项目没有可合成的场景视频")
	}

	if err := s.projectRepo.UpdateVideoFields(projectID, "", "", "generating", "", 0); err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(config.GlobalConfig.WanxVideoRequestTimeoutSeconds*2)*time.Second)
	defer cancel()

	videoURL, previewURL, duration, err := composeProjectVideoFiles(ctx, projectID, inputs)
	if err != nil {
		_ = s.projectRepo.UpdateVideoFields(projectID, "", "", "failed", err.Error(), 0)
		return nil, err
	}

	if err := s.projectRepo.UpdateVideoFields(projectID, videoURL, previewURL, "succeeded", "", duration); err != nil {
		return nil, err
	}

	return s.projectRepo.FindByID(projectID)
}

func (s *ProjectVideoService) collectProjectVideoInputs(chapters []models.Chapter) ([]projectVideoInput, error) {
	inputs := make([]projectVideoInput, 0)
	for _, chapter := range chapters {
		scenes, err := s.sceneRepo.FindByChapterID(chapter.ID)
		if err != nil {
			return nil, err
		}
		for _, scene := range scenes {
			if strings.TrimSpace(scene.VideoURL) == "" || scene.VideoStatus != "succeeded" {
				continue
			}
			localPath, err := generatedSceneAssetURLToLocalPath(scene.VideoURL)
			if err != nil {
				continue
			}
			if _, err := os.Stat(localPath); err != nil {
				continue
			}
			duration := scene.VideoDuration
			if duration <= 0 {
				duration = 5
			}
			inputs = append(inputs, projectVideoInput{
				sceneID:    scene.ID,
				path:       localPath,
				duration:   duration,
				chapterOrd: chapter.SortOrder,
				sceneOrd:   scene.SortOrder,
			})
		}
	}

	sort.SliceStable(inputs, func(i, j int) bool {
		if inputs[i].chapterOrd == inputs[j].chapterOrd {
			if inputs[i].sceneOrd == inputs[j].sceneOrd {
				return inputs[i].sceneID < inputs[j].sceneID
			}
			return inputs[i].sceneOrd < inputs[j].sceneOrd
		}
		return inputs[i].chapterOrd < inputs[j].chapterOrd
	})
	return inputs, nil
}

func composeProjectVideoFiles(ctx context.Context, projectID int64, inputs []projectVideoInput) (string, string, float64, error) {
	assetRoot := config.GlobalConfig.GeneratedAssetDir
	var err error
	if !filepath.IsAbs(assetRoot) {
		assetRoot, err = filepath.Abs(filepath.Join(".", assetRoot))
		if err != nil {
			return "", "", 0, err
		}
	}

	projectVideosDir := filepath.Join(assetRoot, "project-videos")
	if err := os.MkdirAll(projectVideosDir, 0o755); err != nil {
		return "", "", 0, fmt.Errorf("创建项目视频目录失败: %w", err)
	}

	workDir, err := os.MkdirTemp(projectVideosDir, fmt.Sprintf("project-%d-compose-*", projectID))
	if err != nil {
		return "", "", 0, fmt.Errorf("创建项目视频临时目录失败: %w", err)
	}
	defer os.RemoveAll(workDir)

	transcodedPaths := make([]string, 0, len(inputs))
	totalDuration := 0.0
	for idx, input := range inputs {
		tempPath := filepath.Join(workDir, fmt.Sprintf("temp-scene-%03d.mp4", idx+1))
		if err := transcodeProjectInput(ctx, input.path, tempPath); err != nil {
			return "", "", 0, err
		}
		transcodedPaths = append(transcodedPaths, tempPath)
		totalDuration += input.duration
	}

	inputsFile := filepath.Join(workDir, "inputs.txt")
	if err := writeConcatInputs(inputsFile, transcodedPaths); err != nil {
		return "", "", 0, err
	}

	filename := fmt.Sprintf("project-%d-%d.mp4", projectID, time.Now().Unix())
	finalPath := filepath.Join(projectVideosDir, filename)
	if err := concatProjectVideos(ctx, inputsFile, finalPath); err != nil {
		return "", "", 0, err
	}

	previewFilename := strings.TrimSuffix(filename, ".mp4") + ".preview.mp4"
	previewPath := filepath.Join(projectVideosDir, previewFilename)
	if err := generateProjectVideoPreview(ctx, finalPath, previewPath); err != nil {
		return "", "", 0, err
	}

	basePath := strings.TrimRight(config.GlobalConfig.GeneratedAssetBasePath, "/")
	return fmt.Sprintf("%s/project-videos/%s", basePath, filename), fmt.Sprintf("%s/project-videos/%s", basePath, previewFilename), totalDuration, nil
}

func transcodeProjectInput(ctx context.Context, inputPath, outputPath string) error {
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
		return fmt.Errorf("场景视频转码失败: %v: %s", err, strings.TrimSpace(string(output)))
	}
	return nil
}

func concatProjectVideos(ctx context.Context, inputsFile, outputPath string) error {
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
		return fmt.Errorf("项目总片合成失败: %v: %s", err, strings.TrimSpace(string(output)))
	}
	return nil
}

func generateProjectVideoPreview(ctx context.Context, srcPath, previewPath string) error {
	cmd := exec.CommandContext(
		ctx,
		"ffmpeg",
		"-y",
		"-i", srcPath,
		"-vf", fmt.Sprintf("scale=-2:%d,fps=%d", sceneVideoPreviewHeight, sceneVideoFPS),
		"-c:v", "libx264",
		"-preset", "veryfast",
		"-crf", "30",
		"-c:a", "aac",
		"-b:a", "96k",
		"-movflags", "+faststart",
		previewPath,
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("生成项目视频预览失败: %v: %s", err, strings.TrimSpace(string(output)))
	}
	return nil
}
