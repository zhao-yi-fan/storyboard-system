import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AssetRequirement } from "../../api";
import { AssetPreparation } from "./AssetPreparation";
import { missingCandidates, preparationSummary } from "./AssetPreparation.helpers";

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
      <AssetPreparation
        chapters={[]}
        chapterId={1}
        kind="character"
        items={requirements}
        loading={false}
        error=""
        busy={false}
        onChapter={vi.fn()}
        onKind={vi.fn()}
        onOpen={onOpen}
        onGenerate={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "补参考素材" }).dataset.variant).toBe("outline");
    expect(screen.getByRole("button", { name: "补齐本集缺失图片（1）" }).dataset.variant).toBe(
      "default",
    );
    fireEvent.click(screen.getByRole("button", { name: "补参考素材" }));
    expect(onOpen).toHaveBeenCalledWith(requirements[0]);
    expect(screen.getByText("再生成失败")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "补齐本集缺失图片（1）" }));
    expect(screen.getByText("场景：1 项")).toBeInTheDocument();
    expect(screen.getByText("角色：0 项")).toBeInTheDocument();
  });
});
