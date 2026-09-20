import { describe, expect, it } from "vitest";

import type { Asset, Project, Scene, Storyboard, StoryboardMediaGeneration } from "../../api";
import {
  buildCoverPreviewItems,
  buildShotFormState,
  emptyDescriptionOptimization,
  emptySceneForm,
  emptyShotForm,
  formatPromptForDisplay,
  formatShanghaiDateTime,
  getAssetFileExtension,
  getAssetMentionPresentation,
  getGenerationPreviewSrc,
  getProjectVideoPreviewSrc,
  getSceneNavigatorThumbnailSrc,
  getStoryboardPreviewSrc,
  getStoryboardVideoPreviewSrc,
  isSeedanceVideoModel,
  sceneMediaToWorkspaceMedia,
  sceneToWorkspaceClip,
  VIDEO_MODEL_OPTIONS,
} from "./Workspace.helpers";

const asset = (overrides: Partial<Asset> = {}) =>
  ({
    id: 1,
    file_url: "https://cdn.example.com/a.png",
    type: "scene",
    ...overrides,
  }) as Asset;

describe("getAssetFileExtension", () => {
  it("strips query and hash, lowercases", () => {
    expect(getAssetFileExtension(asset({ file_url: "https://x/y.PNG?w=1#h" }))).toBe("png");
  });

  it("returns empty string without extension", () => {
    expect(getAssetFileExtension(asset({ file_url: "https://x/noext" }))).toBe("");
    expect(getAssetFileExtension(asset({ file_url: "" }))).toBe("");
  });
});

describe("getAssetMentionPresentation", () => {
  it("classifies audio by type and extension", () => {
    expect(getAssetMentionPresentation(asset({ type: "voice", file_url: "a.txt" })).category).toBe(
      "audio",
    );
    expect(getAssetMentionPresentation(asset({ type: "scene", file_url: "a.mp3" })).category).toBe(
      "audio",
    );
  });

  it("prefers scene over image", () => {
    expect(getAssetMentionPresentation(asset({ type: "场景", file_url: "a.png" })).category).toBe(
      "scene",
    );
  });

  it("falls back to other", () => {
    expect(getAssetMentionPresentation(asset({ type: "mystery", file_url: "a" })).category).toBe(
      "other",
    );
  });
});

describe("formatPromptForDisplay", () => {
  it("returns dash for empty", () => {
    expect(formatPromptForDisplay(null)).toBe("-");
    expect(formatPromptForDisplay("  ")).toBe("-");
  });

  it("breaks before section markers", () => {
    expect(formatPromptForDisplay("xxx主体与画面核心：yyy")).toBe("xxx\n主体与画面核心：yyy");
  });
});

describe("buildShotFormState", () => {
  it("prefers scene prompt over legacy composite", () => {
    const shot = { content: "raw content" } as Storyboard;
    expect(buildShotFormState(shot, null)).toEqual({ content: expect.any(String) });
    const scene = { prompt: "scene prompt" } as Scene;
    expect(buildShotFormState(shot, scene)).toEqual({ content: "scene prompt" });
  });

  it("empty defaults have content key", () => {
    expect(emptyShotForm).toEqual({ content: "" });
    expect(emptySceneForm).toEqual({ title: "", description: "" });
    expect(emptyDescriptionOptimization.open).toBe(false);
  });
});

describe("adapters", () => {
  it("sceneToWorkspaceClip maps scene onto storyboard shape", () => {
    const scene = {
      id: 7,
      chapter_id: 2,
      project_id: 3,
      prompt: "hello",
      sort_order: 4,
    } as Scene;
    const clip = sceneToWorkspaceClip(scene);
    expect(clip.id).toBe(7);
    expect(clip.scene_id).toBe(7);
    expect(clip.content).toBe("hello");
    expect(clip.characters).toEqual([]);
  });

  it("sceneMediaToWorkspaceMedia copies scene_id", () => {
    const item = { id: 9, scene_id: 7 } as unknown as Parameters<
      typeof sceneMediaToWorkspaceMedia
    >[0];
    expect(sceneMediaToWorkspaceMedia(item).storyboard_id).toBe(7);
  });
});

describe("preview src helpers", () => {
  it("prefers preview urls", () => {
    const shot = {
      thumbnail_url: "t",
      thumbnail_preview_url: "tp",
      video_url: "v",
      video_preview_url: "vp",
    } as Storyboard;
    expect(getStoryboardPreviewSrc(shot)).toBe("tp");
    expect(getStoryboardVideoPreviewSrc(shot)).toBe("vp");
    expect(getStoryboardPreviewSrc(null)).toBe("");
    expect(getStoryboardVideoPreviewSrc(undefined)).toBe("");
  });

  it("scene/project/generation fallbacks", () => {
    expect(getSceneNavigatorThumbnailSrc({ cover_url: "c" } as Scene)).toBe("c");
    expect(getProjectVideoPreviewSrc({ video_url: "v" } as Project)).toBe("v");
    expect(getGenerationPreviewSrc({ result_url: "r" } as StoryboardMediaGeneration)).toBe("r");
  });
});

describe("buildCoverPreviewItems", () => {
  it("keeps succeeded generations with url", () => {
    const generations = [
      { id: 1, status: "succeeded", result_url: "u1" },
      { id: 2, status: "failed", result_url: "u2" },
      { id: 3, status: "succeeded", result_url: "" },
    ] as StoryboardMediaGeneration[];
    expect(buildCoverPreviewItems(generations)).toEqual([{ src: "u1", alt: "首帧历史 1" }]);
  });
});

describe("misc", () => {
  it("detects seedance model", () => {
    expect(isSeedanceVideoModel(VIDEO_MODEL_OPTIONS[0].value)).toBe(true);
    expect(isSeedanceVideoModel("wan2.7-i2v")).toBe(false);
  });

  it("formats shanghai datetime", () => {
    expect(formatShanghaiDateTime(undefined)).toBe("");
    expect(formatShanghaiDateTime("2026-09-01T00:00:00.000Z")).toContain("2026");
  });
});
