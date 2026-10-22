// @ts-expect-error CSS contract checks run in Vitest's Node runtime.
import { readFileSync } from "node:fs";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Input } from "./input";
import styles from "./text-field.module.scss";
import { Textarea } from "./textarea";

describe("shared text field focus", () => {
  it.each([Input, Textarea])(
    "preserves input, invalid and disabled props with one focus owner",
    (Field) => {
      const change = vi.fn();
      const { rerender } = render(
        <Field aria-label="描述" onChange={change} className="page-field" />,
      );
      const field = screen.getByRole("textbox");
      expect(field.className).toContain(styles.field);
      expect(field.className).toContain("page-field");
      expect(field.className).not.toContain("focus-visible:ring");
      fireEvent.change(field, { target: { value: "新描述" } });
      expect(change).toHaveBeenCalledOnce();
      rerender(<Field aria-label="描述" aria-invalid="true" disabled />);
      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(field).toBeDisabled();
    },
  );

  it("keeps the global fallback separate and defines a single thin halo", () => {
    const theme = readFileSync("src/styles/theme.css", "utf8");
    const focus = readFileSync("src/app/components/ui/text-field.module.scss", "utf8");
    expect(theme).toContain('input:not([data-slot="input"])');
    expect(theme).toContain('textarea:not([data-slot="textarea"])');
    expect(focus).toContain('&:focus:not(:disabled):not([aria-disabled="true"])');
    expect(focus).toContain("outline: none");
    expect(focus).toContain("0 0 0 2px color-mix(in srgb, var(--brand) 25%, transparent)");
    expect(focus).toContain("0 0 0 2px color-mix(in srgb, var(--danger) 25%, transparent)");
    expect(focus).toContain("box-shadow: none");
    expect(focus).toContain("prefers-reduced-motion: reduce");
  });
});
