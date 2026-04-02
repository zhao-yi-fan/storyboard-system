package services

import "testing"

func TestNormalizeLLMStoryboardDocument_Success(t *testing.T) {
	document := &llmStoryboardDocument{
		Chapters: []llmChapter{
			{
				Title:   "第一章：觉醒",
				Summary: "主角在天台做出命运抉择。",
				Order:   1,
				Scenes: []llmScene{
					{
						Title:      "都市夜晚-天台",
						Summary:    "李明在夜晚的天台独自沉思。",
						Location:   "天台",
						TimeOfDay:  "夜晚",
						Order:      1,
						Characters: []string{"李明"},
						Storyboards: []llmStoryboard{
							{
								Order:             1,
								ShotNumber:        1,
								VisualDescription: "夜色中的天台全景，李明站在边缘。",
								Dialogue:          "如果能重来一次，我不会这样选择。",
								DurationSeconds:   5,
								ShotType:          "全景",
								CameraAngle:       "平视",
								Mood:              "压抑",
								Notes:             "开场建立镜头",
								Characters:        []string{"李明"},
							},
						},
					},
				},
			},
		},
		Characters: []llmCharacter{
			{
				Name:        "李明",
				Description: "男主角，陷入人生低谷。",
				Appearance:  "二十多岁，神情疲惫。",
				Tags:        []string{"主角", "都市"},
			},
		},
	}

	parsed, characters, err := normalizeLLMStoryboardDocument(document)
	if err != nil {
		t.Fatalf("expected success, got error: %v", err)
	}

	if len(parsed.Chapters) != 1 {
		t.Fatalf("expected 1 chapter, got %d", len(parsed.Chapters))
	}
	if len(parsed.Chapters[0].Scenes) != 1 {
		t.Fatalf("expected 1 scene, got %d", len(parsed.Chapters[0].Scenes))
	}
	if len(parsed.Chapters[0].Scenes[0].Storyboards) != 1 {
		t.Fatalf("expected 1 storyboard, got %d", len(parsed.Chapters[0].Scenes[0].Storyboards))
	}
	if len(characters) != 1 {
		t.Fatalf("expected 1 character, got %d", len(characters))
	}
	if parsed.Chapters[0].Scenes[0].Storyboards[0].Dialogue == "" {
		t.Fatalf("expected storyboard dialogue to be preserved")
	}
}

func TestNormalizeLLMStoryboardDocument_RejectsEmptyChapters(t *testing.T) {
	_, _, err := normalizeLLMStoryboardDocument(&llmStoryboardDocument{})
	if err == nil {
		t.Fatalf("expected error for empty chapters")
	}
}

func TestNormalizeLLMStoryboardDocument_RejectsMissingStoryboardDescription(t *testing.T) {
	document := &llmStoryboardDocument{
		Chapters: []llmChapter{
			{
				Title:   "第一章",
				Summary: "摘要",
				Scenes: []llmScene{
					{
						Title:      "场景1",
						Summary:    "场景摘要",
						Storyboards: []llmStoryboard{
							{
								Order:           1,
								ShotNumber:      1,
								DurationSeconds: 5,
							},
						},
					},
				},
			},
		},
	}

	_, _, err := normalizeLLMStoryboardDocument(document)
	if err == nil {
		t.Fatalf("expected error for missing visual_description")
	}
}
