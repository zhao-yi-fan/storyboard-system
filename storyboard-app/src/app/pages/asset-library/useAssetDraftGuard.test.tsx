import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";

import type { Character } from "../../api";
import { useAssetDraftGuard } from "./useAssetDraftGuard";

const character = { id: 1, name: "林婉", description: "原描述", avatar_url: "" } as Character;

function setup(fail = false) {
  const leave = vi.fn();
  function Harness() {
    const guard = useAssetDraftGuard(async () => {
      if (fail) throw new Error("保存失败");
      guard.setSelectedAsset(guard.selectedAsset);
      return guard.selectedAsset;
    });
    const select = guard.setSelectedAsset;
    useEffect(() => select({ type: "character", data: character }), [select]);
    return (
      <>
        <input
          aria-label="名称"
          value={guard.selectedAsset?.data.name ?? ""}
          onChange={(event) =>
            guard.setDraft({ type: "character", data: { ...character, name: event.target.value } })
          }
        />
        <button onClick={() => guard.requestAction(leave)}>切换视图</button>
        <button
          onClick={() =>
            guard.setSelectedAsset({
              type: "character",
              data: { ...character, id: 2, name: "李明" },
            })
          }
        >
          选择李明
        </button>
        <button
          onClick={() =>
            guard.updateSelectedAsset({
              type: "character",
              data: { ...character, name: "旧任务完成" },
            })
          }
        >
          旧任务完成
        </button>
        <button
          onClick={() => guard.updateSelectedAsset({ type: "character", data: character }, true)}
        >
          后台刷新
        </button>
        {guard.dialog}
      </>
    );
  }
  render(<RouterProvider router={createMemoryRouter([{ path: "/", Component: Harness }])} />);
  fireEvent.change(screen.getByRole("textbox", { name: "名称" }), { target: { value: "新名称" } });
  fireEvent.click(screen.getByRole("button", { name: "切换视图" }));
  return leave;
}

describe("asset draft guard", () => {
  it("cancels navigation without discarding the draft", () => {
    const leave = setup();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(leave).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "名称" })).toHaveValue("新名称");
  });
  it("discards back to the saved asset before continuing", async () => {
    const leave = setup();
    fireEvent.click(screen.getByRole("button", { name: "放弃修改" }));
    await waitFor(() => expect(leave).toHaveBeenCalledOnce());
    expect(screen.getByRole("textbox", { name: "名称" })).toHaveValue("林婉");
  });
  it("does not continue when saving fails", async () => {
    const leave = setup(true);
    fireEvent.click(screen.getByRole("button", { name: "保存并继续" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("保存失败"));
    expect(leave).not.toHaveBeenCalled();
  });
  it("continues once after saving successfully", async () => {
    const leave = setup();
    fireEvent.click(screen.getByRole("button", { name: "保存并继续" }));
    await waitFor(() => expect(leave).toHaveBeenCalledOnce());
    expect(screen.getByRole("textbox", { name: "名称" })).toHaveValue("新名称");
  });
  it("does not let an old asynchronous task replace another selected asset", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    fireEvent.click(screen.getByRole("button", { name: "选择李明" }));
    fireEvent.click(screen.getByRole("button", { name: "旧任务完成" }));
    expect(screen.getByRole("textbox", { name: "名称" })).toHaveValue("李明");
  });
  it("preserves unsaved fields during background refresh", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    fireEvent.click(screen.getByRole("button", { name: "后台刷新" }));
    expect(screen.getByRole("textbox", { name: "名称" })).toHaveValue("新名称");
  });
});
