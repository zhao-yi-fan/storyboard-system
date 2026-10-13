import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Storyboard, StoryboardMediaGeneration } from "../../api";
import { sceneToWorkspaceClip, VIDEO_MODEL_OPTIONS } from "./Workspace.helpers";
import { WorkspacePreviewStage } from "./WorkspacePreviewStage";

const base = {
  isEpisodeRailCollapsed: false,
  currentVideoGeneration: null,
  timeoutVideoGeneration: null,
  isResumingVideo: false,
  onResumeVideo: vi.fn(),
  setFrameExtractionGeneration: vi.fn(),
  videoGenerations: [],
  activeMediaActionKey: null,
  handleSetCurrentGeneration: vi.fn(),
  handleTogglePinGeneration: vi.fn(),
  handleRequestDeleteGeneration: vi.fn(),
};
const shot = (status: string, disconnected = false) =>
  ({
    id: 1,
    video_status: "generating",
    local_video_job: { id: 2, status, disconnected },
  }) as Storyboard;

describe("local video generation UI", () => {
  it("offers the local model and preserves its task state in scene adapters", () => {
    expect(VIDEO_MODEL_OPTIONS.some((option) => option.value === "minimax-h3-local")).toBe(true);
    const scene = { id: 1, local_video_job: { id: 2, status: "queued", disconnected: false } };
    expect(
      sceneToWorkspaceClip(scene as Parameters<typeof sceneToWorkspaceClip>[0]).local_video_job,
    ).toEqual(scene.local_video_job);
  });
  it.each([
    ["queued", "等待本地电脑领取任务"],
    ["uploading", "视频上传中"],
  ])("shows %s status", (status, text) => {
    render(<WorkspacePreviewStage {...base} selectedShot={shot(status)} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });
  it("lets users retry an interrupted job", async () => {
    const onResumeVideo = vi.fn();
    render(
      <WorkspacePreviewStage
        {...base}
        onResumeVideo={onResumeVideo}
        selectedShot={shot("generating", true)}
      />,
    );
    expect(screen.getByText("本地电脑连接中断，等待恢复")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "重新提交本地任务" }));
    expect(onResumeVideo).toHaveBeenCalledWith(0);
  });
  it("keeps model errors visible and offers manual retry", () => {
    render(
      <WorkspacePreviewStage
        {...base}
        selectedShot={{
          ...shot("failed"),
          video_status: "failed",
          video_error: "CUDA out of memory",
        }}
      />,
    );
    expect(screen.getByText("CUDA out of memory")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新提交本地任务" })).toBeInTheDocument();
  });
  it("renders the completed result and its history video", () => {
    const generation = {
      id: 3,
      status: "succeeded",
      result_url: "/generated/local-videos/3.mp4",
      is_current: true,
    } as StoryboardMediaGeneration;
    const { container } = render(
      <WorkspacePreviewStage
        {...base}
        selectedShot={{
          ...shot("succeeded"),
          video_status: "succeeded",
          video_url: generation.result_url,
        }}
        videoGenerations={[generation]}
      />,
    );
    expect(container.querySelectorAll("video")).toHaveLength(2);
    expect(screen.getByText("v1")).toBeInTheDocument();
  });
  it("toggles pin with an explicit retention tooltip", async () => {
    const generation = {
      id: 4,
      status: "succeeded",
      result_url: "/generated/local-videos/4.mp4",
      is_current: false,
      is_pinned: false,
    } as StoryboardMediaGeneration;
    const handleTogglePinGeneration = vi.fn();
    const { rerender } = render(
      <WorkspacePreviewStage
        {...base}
        handleTogglePinGeneration={handleTogglePinGeneration}
        selectedShot={{
          ...shot("succeeded"),
          video_status: "succeeded",
          video_url: generation.result_url,
        }}
        videoGenerations={[generation]}
      />,
    );
    const pinButton = screen.getByRole("button", { name: "钉住历史版本" });
    expect(pinButton.getAttribute("title")).toMatch(/最多保留 10 条/);
    await userEvent.setup().click(pinButton);
    expect(handleTogglePinGeneration).toHaveBeenCalledWith(generation);
    rerender(
      <WorkspacePreviewStage
        {...base}
        handleTogglePinGeneration={handleTogglePinGeneration}
        selectedShot={{
          ...shot("succeeded"),
          video_status: "succeeded",
          video_url: generation.result_url,
        }}
        videoGenerations={[{ ...generation, is_pinned: true }]}
      />,
    );
    expect(
      screen.getByRole("button", { name: "取消钉住历史版本" }).getAttribute("title"),
    ).toMatch(/不会被自动清理/);
  });
});
