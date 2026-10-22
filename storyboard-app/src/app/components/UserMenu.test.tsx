import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { UserMenu } from "./UserMenu";

vi.mock("../lib/auth", () => ({
  getAuthSession: () => ({ display_name: "这是一个非常长的创作者名称", role_label: "创作者" }),
  clearAuthSession: vi.fn(),
}));

describe("account menu placement", () => {
  it.each(["sidebar", "header"] as const)(
    "preserves click-only account actions in %s",
    (placement) => {
      render(
        <MemoryRouter>
          <UserMenu placement={placement} />
        </MemoryRouter>,
      );
      const trigger = screen.getByRole("button", { name: "账号：这是一个非常长的创作者名称" });
      expect(trigger.parentElement).toHaveAttribute("data-placement", placement);
      expect(trigger).toHaveAttribute("title", "这是一个非常长的创作者名称");
      fireEvent.mouseEnter(trigger);
      expect(screen.queryByRole("button", { name: "退出登录" })).not.toBeInTheDocument();
      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("button", { name: "退出登录" })).toBeInTheDocument();
      fireEvent.mouseDown(document.body);
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    },
  );
});
