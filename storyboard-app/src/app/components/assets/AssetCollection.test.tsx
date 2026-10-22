import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Asset } from "../../api";
import { AssetCollection } from "./AssetCollection";

describe("asset classification labels", () => {
  it.each([
    ["scene", "场景"],
    ["prop", "道具"],
  ])("shows only the Chinese category for %s", (type, label) => {
    const asset = { id: 1, name: "测试素材", type, meta: "描述" } as Asset;
    const select = vi.fn();
    render(
      <AssetCollection
        assets={[asset]}
        emptyLabel="暂无资产"
        loading={false}
        viewMode="grid"
        selectedAssetId={null}
        onSelect={select}
      />,
    );
    expect(screen.getAllByText(label)).toHaveLength(1);
    expect(screen.queryByText(type, { exact: true })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(select).toHaveBeenCalledWith(asset);
  });
});
