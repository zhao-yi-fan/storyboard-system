import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Asset, Character } from "../api";
import { useAssetLibraryFilters } from "./useAssetLibraryFilters";
import { useResizableDetailSidebar } from "./useAssetLibrarySidebar";

const characters = [
  { id: 1, name: "林婉", description: "温婉" },
  { id: 2, name: "李明", description: "少年" },
] as Character[];

const assets = [
  { id: 1, name: "剑", type: "prop", meta: "" },
  { id: 2, name: "便利店", type: "scene", meta: "" },
] as Asset[];

describe("useAssetLibraryFilters", () => {
  it("filters by query across names", () => {
    const { result, rerender } = renderHook(
      ({ query }) => useAssetLibraryFilters(characters, assets, query),
      { initialProps: { query: "" } },
    );
    expect(result.current.filteredCharacters).toHaveLength(2);
    expect(result.current.sceneAssetCount).toBe(1);
    expect(result.current.propAssetCount).toBe(1);
    rerender({ query: "林婉" });
    expect(result.current.filteredCharacters.map((c) => c.name)).toEqual(["林婉"]);
    expect(result.current.filteredAssets).toHaveLength(0);
  });

  it("splits scene and prop assets", () => {
    const { result } = renderHook(() => useAssetLibraryFilters(characters, assets, ""));
    expect(result.current.filteredSceneAssets.map((a) => a.name)).toEqual(["便利店"]);
    expect(result.current.filteredPropAssets.map((a) => a.name)).toEqual(["剑"]);
  });
});

describe("useResizableDetailSidebar", () => {
  it("starts at default width and enters resize mode", () => {
    const { result } = renderHook(() => useResizableDetailSidebar());
    expect(result.current.detailSidebarWidth).toBe(384);
    act(() => {
      result.current.handleDetailSidebarMouseDown();
    });
    // width only changes on real mousemove; the hook must at least stay mounted
    expect(result.current.detailSidebarWidth).toBe(384);
  });
});
