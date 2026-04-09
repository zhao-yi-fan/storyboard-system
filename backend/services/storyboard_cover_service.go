package services

import (
    "context"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "net/url"
    "os"
    "path/filepath"
    "strings"
    "time"

    "storyboard-backend/config"
    "storyboard-backend/models"
    "storyboard-backend/repository"
)

type StoryboardCoverService struct {
    storyboardRepo *repository.StoryboardRepository
    sceneRepo      *repository.SceneRepository
    assetRepo      *repository.AssetRepository
    historyRepo    *repository.StoryboardMediaGenerationRepository
    wanxClient     *WanxClient
    httpClient     *http.Client
    previewService *ImagePreviewService
}

type StoryboardCoverReferenceImage struct {
    Type   string `json:"type"`
    Name   string `json:"name"`
    URL    string `json:"url"`
    Source string `json:"source"`
}

type StoryboardCoverGenerationFields struct {
    SceneTitle      string   `json:"scene_title"`
    Location        string   `json:"location"`
    TimeOfDay       string   `json:"time_of_day"`
    Background      string   `json:"background"`
    Characters      []string `json:"characters"`
    ShotType        string   `json:"shot_type"`
    CameraDirection string   `json:"camera_direction"`
    Content         string   `json:"content"`
    Mood            string   `json:"mood"`
    Dialogue        string   `json:"dialogue"`
    Notes           string   `json:"notes"`
}

type StoryboardCoverGenerationPreview struct {
    Mode                         string                           `json:"mode"`
    Model                        string                           `json:"model"`
    ReferenceImages              []StoryboardCoverReferenceImage `json:"reference_images"`
    MissingReferences            []string                         `json:"missing_references"`
    Fields                       StoryboardCoverGenerationFields `json:"fields"`
    FinalPrompt                  string                           `json:"final_prompt"`
    CanGenerateWithoutReferences bool                             `json:"can_generate_without_references"`
}

func NewStoryboardCoverService() (*StoryboardCoverService, error) {
    wanxClient, err := NewWanxClient()
    if err != nil {
        return nil, err
    }

    return &StoryboardCoverService{
        storyboardRepo: &repository.StoryboardRepository{},
        sceneRepo:      &repository.SceneRepository{},
        assetRepo:      &repository.AssetRepository{},
        historyRepo:    &repository.StoryboardMediaGenerationRepository{},
        wanxClient:     wanxClient,
        httpClient:     &http.Client{Timeout: 60 * time.Second},
        previewService: NewImagePreviewService(),
    }, nil
}

func (s *StoryboardCoverService) PreviewGeneration(storyboardID int64, publicBaseURL string) (*StoryboardCoverGenerationPreview, error) {
    storyboard, scene, err := s.loadStoryboardContext(storyboardID)
    if err != nil {
        return nil, err
    }
    return s.buildGenerationPreview(storyboard, scene, publicBaseURL, false)
}

func (s *StoryboardCoverService) GenerateAndAttach(storyboardID int64, publicBaseURL string, useTextOnly bool) (*models.Storyboard, error) {
    storyboard, scene, err := s.loadStoryboardContext(storyboardID)
    if err != nil {
        return nil, err
    }

    preview, err := s.buildGenerationPreview(storyboard, scene, publicBaseURL, useTextOnly)
    if err != nil {
        return nil, err
    }

    generation := &models.StoryboardMediaGeneration{
        StoryboardID: storyboard.ID,
        MediaType:    "cover",
        Model:        preview.Model,
        Status:       "generating",
        SourceURL:    firstReferenceURL(preview.ReferenceImages),
        MetaJSON: mustMarshalMediaMeta(map[string]any{
            "resolution":      "1024x576",
            "preview_format":  "webp",
            "preview_width":   480,
            "reference_count": len(preview.ReferenceImages),
            "reference_types": referenceTypes(preview.ReferenceImages),
            "generation_mode": preview.Mode,
        }),
    }
    if err := s.historyRepo.Create(generation); err != nil {
        return nil, err
    }

    ctx, cancel := context.WithTimeout(context.Background(), time.Duration(config.GlobalConfig.WanxRequestTimeoutSeconds)*time.Second)
    defer cancel()

    var imageURL string
    if preview.Mode == "reference" && len(preview.ReferenceImages) > 0 {
        imageURL, err = s.wanxClient.GenerateImageWithReferences(ctx, preview.FinalPrompt, collectReferenceURLs(preview.ReferenceImages), preview.Model)
    } else {
        imageURL, err = s.wanxClient.GenerateImage(ctx, preview.FinalPrompt)
    }
    if err != nil {
        s.markGenerationFailed(generation, err)
        return nil, err
    }

    publicPath, localPath, err := s.downloadAndStore(ctx, storyboard.ID, imageURL)
    if err != nil {
        s.markGenerationFailed(generation, err)
        return nil, err
    }

    previewFilename := strings.TrimSuffix(filepath.Base(localPath), filepath.Ext(localPath)) + ".thumb.webp"
    previewPath, err := s.previewService.CreatePreviewFromLocalPath(localPath, "covers", previewFilename, StoryboardPreviewSpec())
    if err != nil {
        s.markGenerationFailed(generation, err)
        return nil, err
    }

    storyboard.ThumbnailURL = publicPath
    storyboard.ThumbnailPreviewURL = previewPath
    if err := s.storyboardRepo.Update(storyboard); err != nil {
        s.markGenerationFailed(generation, err)
        return nil, err
    }

    generation.Status = "succeeded"
    generation.ResultURL = publicPath
    generation.PreviewURL = previewPath
    generation.ErrorMessage = ""
    if err := s.historyRepo.Update(generation); err != nil {
        return nil, err
    }
    if err := s.historyRepo.MarkCurrent(storyboard.ID, generation.MediaType, generation.ID); err != nil {
        return nil, err
    }

    return s.storyboardRepo.FindByID(storyboard.ID)
}

func (s *StoryboardCoverService) loadStoryboardContext(storyboardID int64) (*models.Storyboard, *models.Scene, error) {
    storyboard, err := s.storyboardRepo.FindByID(storyboardID)
    if err != nil {
        return nil, nil, err
    }
    if storyboard == nil {
        return nil, nil, fmt.Errorf("storyboard not found")
    }

    scene, err := s.sceneRepo.FindByID(storyboard.SceneID)
    if err != nil {
        return nil, nil, err
    }
    if scene == nil {
        return nil, nil, fmt.Errorf("scene not found")
    }

    return storyboard, scene, nil
}

func (s *StoryboardCoverService) buildGenerationPreview(storyboard *models.Storyboard, scene *models.Scene, publicBaseURL string, forceTextOnly bool) (*StoryboardCoverGenerationPreview, error) {
    fields := buildStoryboardCoverFields(storyboard, scene)
    referenceImages, missingReferences, err := s.selectReferenceImages(storyboard, scene, publicBaseURL)
    if err != nil {
        return nil, err
    }

    mode := "text-only"
    model := strings.TrimSpace(config.GlobalConfig.WanxModel)
    if model == "" {
        model = "qwen-image-2.0"
    }
    if !forceTextOnly && len(referenceImages) > 0 {
        mode = "reference"
        model = strings.TrimSpace(config.GlobalConfig.WanxReferenceModel)
        if model == "" {
            model = "wan2.7-image-pro"
        }
    }

    return &StoryboardCoverGenerationPreview{
        Mode:                         mode,
        Model:                        model,
        ReferenceImages:              referenceImages,
        MissingReferences:            missingReferences,
        Fields:                       fields,
        FinalPrompt:                  buildStoryboardCoverPrompt(fields, referenceImages),
        CanGenerateWithoutReferences: true,
    }, nil
}

func buildStoryboardCoverFields(storyboard *models.Storyboard, scene *models.Scene) StoryboardCoverGenerationFields {
    return StoryboardCoverGenerationFields{
        SceneTitle:      strings.TrimSpace(scene.Title),
        Location:        strings.TrimSpace(scene.Location),
        TimeOfDay:       strings.TrimSpace(scene.TimeOfDay),
        Background:      strings.TrimSpace(storyboard.Background),
        Characters:      storyboardCharacterNames(storyboard),
        ShotType:        strings.TrimSpace(storyboard.ShotType),
        CameraDirection: strings.TrimSpace(storyboard.CameraDirection),
        Content:         strings.TrimSpace(storyboard.Content),
        Mood:            strings.TrimSpace(storyboard.Mood),
        Dialogue:        strings.TrimSpace(storyboard.Dialogue),
        Notes:           strings.TrimSpace(storyboard.Notes),
    }
}

func storyboardCharacterNames(storyboard *models.Storyboard) []string {
    if storyboard == nil {
        return nil
    }
    if len(storyboard.CharacterNames) > 0 {
        return uniqueNonEmptyStrings(storyboard.CharacterNames)
    }
    names := make([]string, 0, len(storyboard.Characters))
    for _, character := range storyboard.Characters {
        if trimmed := strings.TrimSpace(character.Name); trimmed != "" {
            names = append(names, trimmed)
        }
    }
    return uniqueNonEmptyStrings(names)
}

func (s *StoryboardCoverService) selectReferenceImages(storyboard *models.Storyboard, scene *models.Scene, publicBaseURL string) ([]StoryboardCoverReferenceImage, []string, error) {
    references := make([]StoryboardCoverReferenceImage, 0, 3)
    missing := make([]string, 0)

    assets, err := s.assetRepo.FindByProjectID(scene.ProjectID)
    if err != nil {
        return nil, nil, err
    }
    for _, asset := range assets {
        assetType := strings.ToLower(strings.TrimSpace(asset.Type))
        if assetType != "scene" && assetType != "background" {
            continue
        }
        if url := absolutizeReferenceURL(publicBaseURL, strings.TrimSpace(asset.CoverURL)); url != "" {
            references = append(references, StoryboardCoverReferenceImage{Type: "scene", Name: strings.TrimSpace(asset.Name), URL: url, Source: "asset.cover_url"})
            break
        }
        if url := absolutizeReferenceURL(publicBaseURL, strings.TrimSpace(asset.FileURL)); url != "" {
            references = append(references, StoryboardCoverReferenceImage{Type: "scene", Name: strings.TrimSpace(asset.Name), URL: url, Source: "asset.file_url"})
            break
        }
    }
    if len(references) == 0 {
        missing = append(missing, "scene")
    }

    selectedCharacterRefs := 0
    seenNames := map[string]struct{}{}
    for _, character := range storyboard.Characters {
        name := strings.TrimSpace(character.Name)
        if name == "" {
            continue
        }
        seenNames[name] = struct{}{}
        avatarURL := absolutizeReferenceURL(publicBaseURL, strings.TrimSpace(character.AvatarURL))
        if avatarURL == "" {
            missing = append(missing, "character:"+name)
            continue
        }
        if selectedCharacterRefs >= 2 {
            continue
        }
        references = append(references, StoryboardCoverReferenceImage{Type: "character", Name: name, URL: avatarURL, Source: "character.avatar_url"})
        selectedCharacterRefs++
    }
    for _, name := range storyboard.CharacterNames {
        trimmed := strings.TrimSpace(name)
        if trimmed == "" {
            continue
        }
        if _, ok := seenNames[trimmed]; ok {
            continue
        }
        missing = append(missing, "character:"+trimmed)
    }

    return references, uniqueNonEmptyStrings(missing), nil
}

func buildStoryboardCoverPrompt(fields StoryboardCoverGenerationFields, referenceImages []StoryboardCoverReferenceImage) string {
    var b strings.Builder
    b.WriteString("为漫剧分镜生成一张单镜头关键帧封面。")
    if fields.SceneTitle != "" {
        b.WriteString(" 场景标题：")
        b.WriteString(fields.SceneTitle)
        b.WriteString("。")
    }
    if fields.Location != "" {
        b.WriteString(" 地点：")
        b.WriteString(fields.Location)
        b.WriteString("。")
    }
    if fields.TimeOfDay != "" {
        b.WriteString(" 时间：")
        b.WriteString(fields.TimeOfDay)
        b.WriteString("。")
    }
    if fields.Background != "" {
        b.WriteString(" 背景环境：")
        b.WriteString(fields.Background)
        b.WriteString("。")
    }
    if len(fields.Characters) > 0 {
        b.WriteString(" 出镜人物：")
        b.WriteString(strings.Join(fields.Characters, "、"))
        b.WriteString("。")
    }
    if fields.ShotType != "" {
        b.WriteString(" 景别：")
        b.WriteString(fields.ShotType)
        b.WriteString("。")
    }
    if fields.CameraDirection != "" {
        b.WriteString(" 机位：")
        b.WriteString(fields.CameraDirection)
        b.WriteString("。")
    }
    if fields.Content != "" {
        b.WriteString(" 画面主体：")
        b.WriteString(fields.Content)
        b.WriteString("。")
    }
    if fields.Mood != "" {
        b.WriteString(" 情绪：")
        b.WriteString(fields.Mood)
        b.WriteString("。")
    }
    if fields.Dialogue != "" {
        b.WriteString(" 台词语义：")
        b.WriteString(sanitizePromptText(fields.Dialogue))
        b.WriteString("。")
    }
    if fields.Notes != "" {
        b.WriteString(" 备注补充：")
        b.WriteString(sanitizePromptText(fields.Notes))
        b.WriteString("。")
    }

    hasSceneRef := false
    hasCharacterRef := false
    for _, ref := range referenceImages {
        switch ref.Type {
        case "scene":
            hasSceneRef = true
        case "character":
            hasCharacterRef = true
        }
    }
    if hasCharacterRef {
        b.WriteString(" 如果有人物参考图，优先保持人物长相、发型、服装和气质一致。")
    }
    if hasSceneRef {
        b.WriteString(" 如果有场景参考图，优先保持场景结构、材质和光线氛围一致。")
    }

    b.WriteString(" 画面要求：只生成一个明确的单镜头瞬间，单主体优先，不要多主体争抢画面。")
    b.WriteString(" 风格要求：写实电影感、叙事性强、构图清晰、景深自然、光影克制，适合做分镜封面。")
    b.WriteString(" 输出要求：横版16:9，不要海报排版，不要文字、水印、logo、边框，不要拼贴、不要多格漫画、不要分镜条。")
    return b.String()
}

func referenceTypes(referenceImages []StoryboardCoverReferenceImage) []string {
    types := make([]string, 0, len(referenceImages))
    for _, ref := range referenceImages {
        if trimmed := strings.TrimSpace(ref.Type); trimmed != "" {
            types = append(types, trimmed)
        }
    }
    return types
}

func collectReferenceURLs(referenceImages []StoryboardCoverReferenceImage) []string {
    urls := make([]string, 0, len(referenceImages))
    for _, ref := range referenceImages {
        if trimmed := strings.TrimSpace(ref.URL); trimmed != "" {
            urls = append(urls, trimmed)
        }
    }
    return urls
}

func firstReferenceURL(referenceImages []StoryboardCoverReferenceImage) string {
    for _, ref := range referenceImages {
        if trimmed := strings.TrimSpace(ref.URL); trimmed != "" {
            return trimmed
        }
    }
    return ""
}

func uniqueNonEmptyStrings(values []string) []string {
    seen := map[string]struct{}{}
    result := make([]string, 0, len(values))
    for _, value := range values {
        trimmed := strings.TrimSpace(value)
        if trimmed == "" {
            continue
        }
        if _, ok := seen[trimmed]; ok {
            continue
        }
        seen[trimmed] = struct{}{}
        result = append(result, trimmed)
    }
    return result
}

func absolutizeReferenceURL(publicBaseURL, rawURL string) string {
    trimmed := strings.TrimSpace(rawURL)
    if trimmed == "" {
        return ""
    }
    if strings.HasPrefix(trimmed, "http://") || strings.HasPrefix(trimmed, "https://") {
        return trimmed
    }
    if !strings.HasPrefix(trimmed, "/") {
        return trimmed
    }
    base := strings.TrimRight(strings.TrimSpace(publicBaseURL), "/")
    if base == "" {
        return trimmed
    }
    return base + trimmed
}

func (s *StoryboardCoverService) markGenerationFailed(generation *models.StoryboardMediaGeneration, generationErr error) {
    if generation == nil {
        return
    }
    generation.Status = "failed"
    generation.ErrorMessage = generationErr.Error()
    _ = s.historyRepo.Update(generation)
}

func sanitizePromptText(input string) string {
    replacer := strings.NewReplacer("\n", "；", "\r", "", "\t", " ")
    return replacer.Replace(strings.TrimSpace(input))
}

func (s *StoryboardCoverService) downloadAndStore(ctx context.Context, storyboardID int64, sourceURL string) (string, string, error) {
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
    if err != nil {
        return "", "", err
    }

    resp, err := s.httpClient.Do(req)
    if err != nil {
        return "", "", fmt.Errorf("下载生成图片失败: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode < 200 || resp.StatusCode >= 300 {
        return "", "", fmt.Errorf("下载生成图片失败: HTTP %d", resp.StatusCode)
    }

    assetRoot := config.GlobalConfig.GeneratedAssetDir
    if !filepath.IsAbs(assetRoot) {
        assetRoot, err = filepath.Abs(filepath.Join(".", assetRoot))
        if err != nil {
            return "", "", err
        }
    }
    coversDir := filepath.Join(assetRoot, "covers")
    if err := os.MkdirAll(coversDir, 0o755); err != nil {
        return "", "", fmt.Errorf("创建封面目录失败: %w", err)
    }

    filename := fmt.Sprintf("storyboard-%d-%d%s", storyboardID, time.Now().Unix(), inferImageExtension(sourceURL))
    dstPath := filepath.Join(coversDir, filename)
    file, err := os.Create(dstPath)
    if err != nil {
        return "", "", fmt.Errorf("创建封面文件失败: %w", err)
    }
    defer file.Close()

    if _, err := io.Copy(file, resp.Body); err != nil {
        return "", "", fmt.Errorf("保存封面文件失败: %w", err)
    }

    basePath := strings.TrimRight(config.GlobalConfig.GeneratedAssetBasePath, "/")
    return fmt.Sprintf("%s/covers/%s", basePath, filename), dstPath, nil
}

func inferImageExtension(rawURL string) string {
    parsed, err := url.Parse(rawURL)
    if err != nil {
        return ".png"
    }
    ext := strings.ToLower(filepath.Ext(parsed.Path))
    switch ext {
    case ".jpg", ".jpeg", ".png", ".webp":
        return ext
    default:
        return ".png"
    }
}

func mustMarshalMediaMeta(value map[string]any) string {
    if len(value) == 0 {
        return ""
    }
    encoded, err := json.Marshal(value)
    if err != nil {
        return ""
    }
    return string(encoded)
}
