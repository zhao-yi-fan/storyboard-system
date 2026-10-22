// @ts-expect-error Style contracts are read in Vitest's Node runtime.
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("project card border feedback", () => {
  it("keeps one card hover border without a second media ring on the cover", () => {
    const css = readFileSync("src/app/pages/project-dashboard/ProjectDashboard.module.scss", "utf8");
    const cover = css.slice(css.indexOf(".projectCover {"), css.indexOf(".coverImage {"));
    const feedback = css.slice(css.indexOf("/* Semantic feedback"));
    expect(cover).toContain("cursor: pointer");
    expect(cover).toContain("&:focus-visible");
    expect(cover).toContain("outline-offset: -2px");
    expect(feedback).not.toContain(".projectCover");
    expect(feedback).toContain(".createProject");
    expect(feedback).toContain("interaction.feedback(media)");
    expect(css).toContain("border-color: var(--brand-text)");
    expect(css).toContain(".projectCard:has(.projectCover:active:not(:disabled))");
  });
});
