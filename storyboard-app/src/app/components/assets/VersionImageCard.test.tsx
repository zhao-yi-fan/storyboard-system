import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AssetVersion } from "../../api";
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
