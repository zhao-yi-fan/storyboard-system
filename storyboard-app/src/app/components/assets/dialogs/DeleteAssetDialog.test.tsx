import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ENTITY_TYPE } from "../../../constants/domain";
import { DeleteAssetDialog } from "./DeleteAssetDialog";

describe("DeleteAssetDialog", () => {
  it("renders nothing actionable without a target", () => {
    render(
      <DeleteAssetDialog target={null} deleting={false} onClose={() => {}} onConfirm={() => {}} />,
    );
    expect(screen.queryByRole("button", { name: "确认删除" })).not.toBeInTheDocument();
  });

  it("shows the character copy", () => {
    render(
      <DeleteAssetDialog
        target={{ type: ENTITY_TYPE.CHARACTER, id: 1, name: "林婉" }}
        deleting={false}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText("确认删除角色")).toBeInTheDocument();
  });

  it("shows the prop copy for prop assets", () => {
    render(
      <DeleteAssetDialog
        target={{ type: ENTITY_TYPE.ASSET, id: 2, name: "剑", assetKind: "prop" }}
        deleting={false}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText("确认删除道具资产")).toBeInTheDocument();
  });

  it("confirms and cancels", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <DeleteAssetDialog
        target={{ type: ENTITY_TYPE.CHARACTER, id: 1, name: "林婉" }}
        deleting={false}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );
    await user.click(screen.getByRole("button", { name: "确认删除" }));
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // Confirming also closes the dialog, which notifies onClose too.
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("disables confirm while deleting", () => {
    render(
      <DeleteAssetDialog
        target={{ type: ENTITY_TYPE.CHARACTER, id: 1, name: "林婉" }}
        deleting
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    // While deleting the confirm button shows a spinner instead of its label.
    const confirmButton = screen
      .getAllByRole("button")
      .find((button) => button.textContent !== "取消");
    expect(confirmButton).toBeDefined();
    expect(confirmButton).toBeDisabled();
  });
});
