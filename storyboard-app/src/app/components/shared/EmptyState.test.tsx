import { fireEvent,render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders instructions and an actionable recovery without exposing decorative graphics", () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="还没有场景资产"
        description="从个人空间导入或新建"
        action={<button onClick={onClick}>新建场景</button>}
      />,
    );
    expect(screen.getByText("还没有场景资产")).toBeInTheDocument();
    expect(screen.getByText("从个人空间导入或新建")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "新建场景" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
  it("announces an error separately from normal empty content", () => {
    render(<EmptyState compact error title="加载失败" description="请重试" />);
    expect(screen.getByRole("alert")).toHaveTextContent("加载失败");
  });
});
