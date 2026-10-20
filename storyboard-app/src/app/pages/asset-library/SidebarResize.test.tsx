import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useResizableDetailSidebar } from "./useAssetLibrarySidebar";

function Fixture({ enabled = true }: { enabled?: boolean }) {
  const { resizeHandleProps, isResizingDetailSidebar } = useResizableDetailSidebar(enabled);
  return <div {...resizeHandleProps} data-dragging={isResizingDetailSidebar} />;
}

function pointer(target: HTMLElement, type: string, x: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId: 1, button: 0, clientX: x });
  fireEvent(target, event);
}

function captureHandle() {
  const handle = screen.getByRole("separator");
  handle.setPointerCapture = vi.fn();
  handle.hasPointerCapture = vi.fn(() => true);
  handle.releasePointerCapture = vi.fn();
  return handle;
}

describe("asset sidebar resizing", () => {
  it("supports keyboard direction and bounded endpoints", () => {
    render(<Fixture />);
    const handle = screen.getByRole("separator");
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(handle).toHaveAttribute("aria-valuenow", "400");
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(handle).toHaveAttribute("aria-valuenow", "384");
    fireEvent.keyDown(handle, { key: "Home" });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(handle).toHaveAttribute("aria-valuenow", "320");
    fireEvent.keyDown(handle, { key: "End" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(handle).toHaveAttribute("aria-valuenow", "560");
  });
  it("uses start-relative movement, clamps, and restores original body styles on cancel", () => {
    render(<Fixture />);
    const handle = captureHandle();
    document.body.style.cursor = "crosshair";
    document.body.style.userSelect = "text";
    pointer(handle, "pointerdown", 600);
    expect(handle).toHaveAttribute("data-pointer-focus", "true");
    expect(handle).toHaveAttribute("aria-valuenow", "384");
    pointer(handle, "pointermove", 550);
    expect(handle).toHaveAttribute("aria-valuenow", "434");
    pointer(handle, "pointermove", 0);
    expect(handle).toHaveAttribute("aria-valuenow", "560");
    pointer(handle, "pointermove", 2000);
    expect(handle).toHaveAttribute("aria-valuenow", "320");
    pointer(handle, "pointercancel", 2000);
    expect(handle).toHaveAttribute("data-pointer-focus", "true");
    expect(handle).toHaveAttribute("data-dragging", "false");
    expect(document.body.style.cursor).toBe("crosshair");
    expect(document.body.style.userSelect).toBe("text");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });
  it("restores keyboard focus feedback after a pointer interaction or blur", () => {
    render(<Fixture />);
    const handle = captureHandle();
    pointer(handle, "pointerdown", 600);
    pointer(handle, "pointerup", 600);
    expect(handle).toHaveAttribute("data-pointer-focus", "true");
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(handle).not.toHaveAttribute("data-pointer-focus");
    expect(handle).toHaveAttribute("aria-valuenow", "400");
    pointer(handle, "pointerdown", 600);
    pointer(handle, "pointerup", 600);
    fireEvent.blur(handle);
    expect(handle).not.toHaveAttribute("data-pointer-focus");
  });
  it.each(["pointerup", "lostpointercapture", "blur", "resize", "close", "unmount"])(
    "cleans up active dragging on %s",
    (reason) => {
      const { rerender, unmount } = render(<Fixture />);
      const handle = captureHandle();
      const originalWidth = window.innerWidth;
      pointer(handle, "pointerdown", 600);
      expect(document.body.style.cursor).toBe("col-resize");
      if (reason === "close") rerender(<Fixture enabled={false} />);
      else if (reason === "unmount") unmount();
      else if (reason === "blur") fireEvent(window, new Event("blur"));
      else if (reason === "resize")
        act(() => {
          window.innerWidth = 768;
          window.dispatchEvent(new Event("resize"));
        });
      else pointer(handle, reason, 600);
      expect(document.body.style.cursor).toBe("");
      expect(document.body.style.userSelect).toBe("");
      expect(handle.releasePointerCapture).toHaveBeenCalledWith(1);
      if (reason !== "unmount") expect(handle).toHaveAttribute("data-dragging", "false");
      window.innerWidth = originalWidth;
    },
  );
  it("stops when closed and prevents narrow-screen keyboard resizing", () => {
    const { rerender } = render(<Fixture />);
    rerender(<Fixture enabled={false} />);
    const handle = screen.getByRole("separator");
    fireEvent.keyDown(handle, { key: "End" });
    expect(handle).toHaveAttribute("aria-valuenow", "384");
    rerender(<Fixture />);
    const original = window.innerWidth;
    act(() => {
      window.innerWidth = 390;
      window.dispatchEvent(new Event("resize"));
    });
    fireEvent.keyDown(handle, { key: "End" });
    expect(handle).toHaveAttribute("aria-valuenow", "384");
    window.innerWidth = original;
  });
});
