import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AssetRequirement, assetWorkspaceApi, chapterApi } from "../../api";
import { useAssetPreparation } from "./useAssetPreparation";

vi.mock("../../api", () => ({
  chapterApi: { getChaptersByProject: vi.fn() },
  assetWorkspaceApi: { getRequirements: vi.fn(), generateRequirements: vi.fn() },
}));

const item = {
  id: 1,
  linked_entity_id: 29,
  linked_entity_type: "character",
  kind: "character",
  name: "林婉",
  generation_status: "generating",
  status: "generating",
} as AssetRequirement;

describe("asset preparation requests", () => {
  beforeEach(() => {
    vi.mocked(chapterApi.getChaptersByProject).mockResolvedValue([{ id: 1 }, { id: 2 }] as Awaited<
      ReturnType<typeof chapterApi.getChaptersByProject>
    >);
    vi.mocked(assetWorkspaceApi.getRequirements).mockReset().mockResolvedValue([item]);
    vi.mocked(assetWorkspaceApi.generateRequirements).mockReset().mockResolvedValue([]);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it("uses all chapters explicitly and falls back from an invalid chapter", async () => {
    const hook = renderHook(({ chapter }) => useAssetPreparation(19, chapter, true), {
      initialProps: { chapter: "99" },
    });
    await waitFor(() => expect(hook.result.current.requirements).toHaveLength(1));
    expect(hook.result.current.chapterId).toBe(1);
    hook.rerender({ chapter: "all" });
    await waitFor(() =>
      expect(assetWorkspaceApi.getRequirements).toHaveBeenLastCalledWith(19, undefined),
    );
  });
  it("pauses background polling and refreshes immediately when visible again", async () => {
    vi.useFakeTimers();
    const hook = renderHook(() => useAssetPreparation(19, "1", true));
    await act(async () => {
      await Promise.resolve();
    });
    expect(hook.result.current.requirements).toHaveLength(1);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const calls = vi.mocked(assetWorkspaceApi.getRequirements).mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(assetWorkspaceApi.getRequirements).toHaveBeenCalledTimes(calls);
    visibility.mockReturnValue("visible");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(assetWorkspaceApi.getRequirements).toHaveBeenCalledTimes(calls + 1);
    hook.unmount();
  });
  it("keeps a batch error visible after refreshing business data", async () => {
    const hook = renderHook(() => useAssetPreparation(19, "1", true));
    await waitFor(() => expect(hook.result.current.requirements).toHaveLength(1));
    vi.mocked(assetWorkspaceApi.generateRequirements).mockRejectedValueOnce(
      new Error("生成服务不可用"),
    );
    await act(async () => {
      await hook.result.current.generateMissing();
    });
    expect(hook.result.current.error).toBe("生成服务不可用");
    expect(assetWorkspaceApi.generateRequirements).toHaveBeenCalledWith(19, {
      chapter_id: 1,
      missing_only: true,
    });
  });
});
