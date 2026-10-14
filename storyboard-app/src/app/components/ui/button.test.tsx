import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";
import styles from "./button.module.scss";

describe("semantic button variants", () => {
  it("blocks aria-disabled activation, including a slotted link", () => {
    const click = vi.fn();
    render(
      <Button asChild aria-disabled="true" onClick={click}>
        <a href="/projects" onClick={click}>
          不可用链接
        </a>
      </Button>,
    );
    fireEvent.click(screen.getByRole("link"));
    expect(click).not.toHaveBeenCalled();
  });
  it.each([
    ["default", styles.primary],
    ["outline", styles.secondary],
    ["secondary", styles.secondary],
    ["ghost", styles.ghost],
    ["destructive", styles.danger],
    ["link", styles.link],
  ] as const)("uses the shared %s style", (variant, className) => {
    render(<Button variant={variant}>操作</Button>);
    expect(screen.getByRole("button").className).toContain(className);
    expect(screen.getByRole("button").dataset.variant).toBe(variant);
  });
  it("preserves default styling and disabled behavior", () => {
    const click = vi.fn();
    render(
      <Button disabled onClick={click}>
        加载中
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button.className).toContain(styles.primary);
    fireEvent.click(button);
    expect(click).not.toHaveBeenCalled();
  });
});
