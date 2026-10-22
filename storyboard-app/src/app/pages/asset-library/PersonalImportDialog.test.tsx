import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { assetWorkspaceApi, type PersonalAsset } from "../../api";
import { PersonalImportDialog } from "./PersonalImportDialog";

vi.mock("../../api", () => ({
  assetWorkspaceApi: {
    getPersonalAssets: vi.fn(),
    importPersonalAsset: vi.fn(),
    applyPersonalImage: vi.fn(),
  },
}));
const props = {
  open: true,
  mode: "create" as const,
  kind: "scene",
  projectId: 30,
  onClose: vi.fn(),
  onImported: vi.fn(),
};

describe("PersonalImportDialog states", () => {
  beforeEach(() => vi.clearAllMocks());
  it("shows category-specific guidance and closes without navigating", async () => {
    vi.mocked(assetWorkspaceApi.getPersonalAssets).mockResolvedValue([]);
    render(<PersonalImportDialog {...props} />);
    expect(await screen.findByText("个人空间还没有场景资产")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "知道了" }));
    expect(props.onClose).toHaveBeenCalledOnce();
  });
  it("does not claim an empty library when loading fails and supports retry", async () => {
    vi.mocked(assetWorkspaceApi.getPersonalAssets)
      .mockRejectedValueOnce(new Error("网络异常"))
      .mockResolvedValueOnce([]);
    render(<PersonalImportDialog {...props} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("网络异常");
    expect(screen.queryByText("个人空间还没有场景资产")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    expect(await screen.findByText("个人空间还没有场景资产")).toBeInTheDocument();
    await waitFor(() => expect(assetWorkspaceApi.getPersonalAssets).toHaveBeenCalledTimes(2));
  });
  it("ignores the previous category response after switching", async () => {
    let resolvePrevious!: (items: PersonalAsset[]) => void;
    vi.mocked(assetWorkspaceApi.getPersonalAssets)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePrevious = resolve;
          }),
      )
      .mockResolvedValueOnce([]);
    const { rerender } = render(<PersonalImportDialog {...props} />);
    rerender(<PersonalImportDialog {...props} kind="prop" />);
    expect(await screen.findByText("个人空间还没有道具资产")).toBeInTheDocument();
    await act(async () => resolvePrevious([{ id: 1, name: "过期场景" } as PersonalAsset]));
    expect(screen.queryByText("过期场景")).not.toBeInTheDocument();
    expect(screen.getByText("个人空间还没有道具资产")).toBeInTheDocument();
  });
  it("preserves the library when importing fails and permits another attempt", async () => {
    vi.mocked(assetWorkspaceApi.getPersonalAssets).mockResolvedValue([
      { id: 1, name: "小巷" } as PersonalAsset,
    ]);
    vi.mocked(assetWorkspaceApi.importPersonalAsset).mockRejectedValue(new Error("导入失败"));
    render(<PersonalImportDialog {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "小巷" }));
    expect(assetWorkspaceApi.importPersonalAsset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "导入为新资产" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("导入失败");
    expect(screen.getByRole("button", { name: "小巷" })).toBeEnabled();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(props.onImported).not.toHaveBeenCalled();
  });
  it("previews a selection and applies by entity, not by requirement", async () => {
    vi.mocked(assetWorkspaceApi.getPersonalAssets).mockResolvedValue([
      { id: 1, name: "小巷", file_url: "/generated/new.png" } as PersonalAsset,
    ]);
    vi.mocked(assetWorkspaceApi.applyPersonalImage).mockResolvedValue({
      entity_type: "asset",
      entity_id: 8,
      version_id: 12,
      changed: true,
    });
    props.onImported.mockResolvedValue(undefined);
    const target = {
      entity_type: "asset" as const,
      entity_id: 8,
      kind: "scene" as const,
      name: "古城",
      image: "/generated/old.png",
    };
    render(<PersonalImportDialog {...props} mode="apply-image" target={target} />);
    fireEvent.click(await screen.findByRole("button", { name: "小巷" }));
    expect(screen.getByAltText("当前图片")).toHaveAttribute("src", "/generated/old.png");
    expect(screen.getByAltText("所选图片")).toHaveAttribute("src", "/generated/new.png");
    expect(assetWorkspaceApi.applyPersonalImage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "采用为新版本" }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalledOnce());
    expect(assetWorkspaceApi.applyPersonalImage).toHaveBeenCalledWith(1, 30, target);
    expect(assetWorkspaceApi.importPersonalAsset).not.toHaveBeenCalled();
  });
  it("only refreshes after a committed operation whose refresh failed", async () => {
    vi.mocked(assetWorkspaceApi.getPersonalAssets).mockResolvedValue([
      { id: 1, name: "小巷" } as PersonalAsset,
    ]);
    vi.mocked(assetWorkspaceApi.importPersonalAsset).mockResolvedValue({
      entity_type: "asset",
      entity_id: 8,
      version_id: 12,
      changed: true,
    });
    props.onImported.mockRejectedValueOnce(new Error("网络异常")).mockResolvedValueOnce(undefined);
    render(<PersonalImportDialog {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "小巷" }));
    fireEvent.click(screen.getByRole("button", { name: "导入为新资产" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("操作已完成，刷新失败");
    expect(screen.getByRole("button", { name: "小巷" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "重新刷新" }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalledOnce());
    expect(assetWorkspaceApi.importPersonalAsset).toHaveBeenCalledTimes(1);
  });
  it("cancels a selected image without writing", async () => {
    vi.mocked(assetWorkspaceApi.getPersonalAssets).mockResolvedValue([
      { id: 1, name: "小巷" } as PersonalAsset,
    ]);
    render(<PersonalImportDialog {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "小巷" }));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(assetWorkspaceApi.importPersonalAsset).not.toHaveBeenCalled();
  });
});
