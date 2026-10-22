import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AssetVersion } from "../../api";
import { AssetVersionsDialog } from "./dialogs/AssetVersionsDialog";
import { VersionImageCard } from "./VersionImageCard";

const version = (overrides: Partial<AssetVersion> = {}) =>
  ({
    id: 7,
    is_current: false,
    ...overrides,
  }) as AssetVersion;

const baseProps = {
  version: version(),
  src: "https://cdn.example.com/v7.png",
  alt: "主设定图版本 1",
  label: "v1",
  aspectClassName: "aspect-square",
  switching: false,
  onPreview: () => {},
  onSetCurrent: () => {},
};

describe("VersionImageCard", () => {
  it("shares preview and switch behavior with the all-versions dialog", async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    const onSetCurrent = vi.fn();
    const item = version({ file_url: baseProps.src });
    render(
      <AssetVersionsDialog
        open
        versions={[item]}
        isCharacter
        switchingVersionId={null}
        onOpenChange={() => {}}
        onPreview={onPreview}
        onSetCurrent={onSetCurrent}
      />,
    );
    await user.click(screen.getByRole("button", { name: "预览v1" }));
    expect(onPreview).toHaveBeenCalledWith(baseProps.src, "资产生成版本 1");
    expect(onSetCurrent).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "设为当前版本" }));
    expect(onSetCurrent).toHaveBeenCalledWith(item);
  });
  it("renders image, label and set-current button", () => {
    render(<VersionImageCard {...baseProps} />);
    expect(screen.getByAltText("主设定图版本 1")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "设为当前版本" })).toBeInTheDocument();
  });

  it("hides the button and shows current label for the current version", () => {
    render(<VersionImageCard {...baseProps} version={version({ is_current: true })} />);
    expect(screen.getByText("当前版本")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "设为当前版本" })).not.toBeInTheDocument();
  });

  it("disables the button and shows progress while switching", () => {
    render(<VersionImageCard {...baseProps} switching />);
    expect(screen.getByRole("button", { name: "设为当前版本" })).toBeDisabled();
    expect(screen.getByText("切换中")).toBeInTheDocument();
  });

  it("fires preview and set-current callbacks", async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    const onSetCurrent = vi.fn();
    render(<VersionImageCard {...baseProps} onPreview={onPreview} onSetCurrent={onSetCurrent} />);
    await user.click(screen.getByRole("button", { name: "预览v1" }));
    await user.click(screen.getByRole("button", { name: "设为当前版本" }));
    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onSetCurrent).toHaveBeenCalledTimes(1);
  });
});
