// @ts-expect-error Style contracts are read in Vitest's Node runtime.
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("tooltip arrow", () => {
  it("uses native placement and a shared background color", () => {
    const source = readFileSync("src/app/components/ui/tooltip.tsx", "utf8");
    const arrow = source.slice(source.indexOf("<TooltipPrimitive.Arrow"));
    expect(arrow).toContain("var(--tooltip-background, var(--primary))");
    expect(arrow).not.toMatch(/rotate-45|translate-y|bg-primary/);
    expect(source).toContain("sideOffset = 6");
    const css = readFileSync("src/app/pages/project-dashboard/ProjectDashboard.module.scss", "utf8");
    expect(css).toContain("background-color: var(--tooltip-background)");
  });
});
