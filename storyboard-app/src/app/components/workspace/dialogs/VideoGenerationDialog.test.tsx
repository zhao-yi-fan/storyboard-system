import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import type { StoryboardVideoGenerationPreview } from "../../../api";
import { VideoGenerationDialog } from "./VideoGenerationDialog";

it("shows local configuration errors even without cloud audio reference limits", () => {
  const preview = {
    model: "minimax-h3-local",
    duration: 5,
    resolution: "preview",
    audio: true,
    blocking_reasons: ["本地生成服务尚未配置"],
    audio_reference_limits: null,
  } as StoryboardVideoGenerationPreview;
  render(
    <VideoGenerationDialog
      open
      preview={preview}
      previewSpecLabel="预览"
      sceneTitle="测试"
      selectedModel="minimax-h3-local"
      activeDuration={5}
      useFirstFrame={false}
      shotNumberLabel="1"
      formattedPrompt="测试"
      onOpenChange={vi.fn()}
      onUseFirstFrameChange={vi.fn()}
      onConfirm={vi.fn()}
    />,
  );
  expect(screen.getByText("本地生成服务尚未配置")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "确认生成" })).toBeDisabled();
  expect(screen.getByText(/本地 H3 开启后使用一张首帧/)).toBeInTheDocument();
});
