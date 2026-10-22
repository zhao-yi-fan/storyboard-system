// @ts-expect-error Style contract checks run in Vitest's Node runtime.
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("preparation card feedback", () => {
  it("highlights the entire card without a second image-only border", () => {
    const css = readFileSync("src/app/pages/asset-library/AssetPreparation.module.scss", "utf8");
    const card = css.slice(css.indexOf(".card {"), css.indexOf(".preview {"));
    expect(card).toContain("border: 1px solid #333");
    expect(card).toContain("&:hover");
    expect(card).toContain("border-color: var(--brand-text)");
    expect(card).toContain(":has(button:focus-visible)");
    expect(card).toContain("prefers-reduced-motion: reduce");
    expect(card).not.toContain("cursor: pointer");
    expect(css).not.toContain("interaction.feedback(media)");
    expect(css).toContain("outline-offset: -2px");
  });
});
