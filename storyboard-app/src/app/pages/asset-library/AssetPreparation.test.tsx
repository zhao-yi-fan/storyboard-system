import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AssetRequirement } from "../../api";
import { AssetBatchGenerateAction } from "./AssetBatchGenerateAction";
import { AssetPreparation } from "./AssetPreparation";
import { missingCandidates, preparationSummary } from "./AssetPreparation.helpers";
import { AssetViewNavigation } from "./AssetViewNavigation";

const requirements = [
  {
    id: 1,
    kind: "character",
    name: "林婉",
    linked_entity_type: "character",
    linked_entity_id: 29,
    can_generate: false,
    status: "pending",
  },
  {
    id: 2,
    kind: "scene",
    name: "小巷",
    linked_entity_type: "asset",
    linked_entity_id: 1,
    can_generate: true,
    status: "pending",
  },
  {
    id: 3,
    kind: "scene",
    name: "小巷",
    linked_entity_type: "asset",
    linked_entity_id: 1,
    can_generate: true,
    status: "pending",
  },
  {
    id: 4,
    kind: "character",
    name: "李明",
    linked_entity_type: "character",
    linked_entity_id: 30,
    can_generate: true,
    status: "failed",
    file_url: "/old.png",
    generation_error: "再生成失败",
  },
  {
    id: 5,
    kind: "prop",
    name: "钥匙",
    linked_entity_type: "asset",
    linked_entity_id: 8,
    can_generate: true,
    status: "generating",
  },
] as AssetRequirement[];

describe("asset preparation", () => {
  it("confirms a deduplicated batch once and disables empty candidate sets", () => {
    const onGenerate = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <AssetBatchGenerateAction
        items={requirements}
        loading={false}
        busy={false}
        onGenerate={onGenerate}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "补齐全部集缺失图片（1）" }));
    expect(screen.getByText("场景：1 项")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认生成 1 项" }));
    expect(onGenerate).toHaveBeenCalledOnce();
    rerender(
      <AssetBatchGenerateAction items={[]} loading={false} busy={false} onGenerate={onGenerate} />,
    );
    expect(screen.getByRole("button", { name: "补齐全部集缺失图片（0）" })).toBeDisabled();
  });
  it("deduplicates shared assets and excludes existing, blocked and generating media", () => {
    expect(missingCandidates(requirements).map((item) => item.id)).toEqual([2]);
    expect(preparationSummary(requirements)).toEqual({
      available: 1,
      missing: 3,
      generating: 1,
      failed: 1,
      blocked: 1,
    });
  });
  it("opens the common editor for missing references and keeps batch scope across categories", () => {
    const onOpen = vi.fn();
    render(
      <>
        <AssetViewNavigation
          prepare
          chapterId={1}
          items={requirements}
          loading={false}
          busy={false}
          onView={vi.fn()}
          onImport={vi.fn()}
          onCreate={vi.fn()}
          onGenerate={vi.fn()}
        />
        <AssetPreparation
          chapters={[]}
          chapterId={1}
          kind="character"
          items={requirements}
          loading={false}
          error=""
          onChapter={vi.fn()}
          onKind={vi.fn()}
          onOpen={onOpen}
          onRefresh={vi.fn()}
        />
      </>,
    );
    expect(screen.getByRole("button", { name: "补参考素材" }).dataset.variant).toBe("outline");
    expect(screen.getByRole("button", { name: "补齐本集缺失图片（1）" }).dataset.variant).toBe(
      "default",
    );
    expect(screen.getAllByRole("button", { name: "补齐本集缺失图片（1）" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "补参考素材" }));
    expect(onOpen).toHaveBeenCalledWith(requirements[0]);
    expect(screen.getByText("再生成失败")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "补齐本集缺失图片（1）" }));
    expect(screen.getByText("场景：1 项")).toBeInTheDocument();
    expect(screen.getByText("角色：0 项")).toBeInTheDocument();
  });
  it("switches only the selected view and contextual actions", () => {
    const onView = vi.fn(),
      onImport = vi.fn(),
      onCreate = vi.fn();
    const props = {
      chapterId: 1,
      items: requirements,
      loading: false,
      busy: false,
      onView,
      onImport,
      onCreate,
      onGenerate: vi.fn(),
    };
    const { rerender } = render(<AssetViewNavigation {...props} prepare />);
    expect(screen.getByRole("button", { name: "本集准备" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "全部资产" }));
    expect(onView).toHaveBeenCalledWith("all");
    rerender(<AssetViewNavigation {...props} prepare={false} />);
    expect(screen.getByRole("button", { name: "全部资产" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("button", { name: /补齐本集/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "从个人空间导入" }));
    fireEvent.click(screen.getByRole("button", { name: "新建资产" }));
    expect(onImport).toHaveBeenCalledOnce();
    expect(onCreate).toHaveBeenCalledOnce();
  });
  it.each([
    { loading: true, busy: false },
    { loading: false, busy: true },
  ])("disables batch generation while unavailable: %j", (state) => {
    render(
      <AssetViewNavigation
        prepare
        items={requirements}
        {...state}
        onView={vi.fn()}
        onImport={vi.fn()}
        onCreate={vi.fn()}
        onGenerate={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", {
        name: state.busy ? "正在补齐图片…" : "补齐全部集缺失图片（1）",
      }),
    ).toBeDisabled();
  });
});
