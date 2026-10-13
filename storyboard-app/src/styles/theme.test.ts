// @ts-expect-error This test reads CSS in Vitest's Node runtime; the browser tsconfig excludes Node globals.
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const theme = readFileSync("src/styles/theme.css", "utf8");
function contrast(first: string, second: string) {
  const luminance = (hex: string) => {
    const channels = (hex.match(/[a-f\d]{2}/gi) ?? []).map((channel) => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
describe("brand color contract", () => {
  it("keeps primary, hover and pressed white labels accessible", () => {
    for (const token of ["brand", "brand-hover", "brand-active"]) {
      const color = theme.match(new RegExp(`--${token}: (#[a-f0-9]{6});`))?.[1];
      if (!color) throw new Error(`Missing theme token: ${token}`);
      expect(contrast(color, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("uses readable selected and status labels on light and dark surfaces", () => {
    for (const [foreground, background] of [
      ["#7e22ce", "#f3e8ff"],
      ["#d8b4fe", "#302039"],
      ["#86efac", "#191919"],
      ["#fde047", "#191919"],
      ["#fca5a5", "#191919"],
      ["#166534", "#ffffff"],
      ["#854d0e", "#ffffff"],
      ["#b91c1c", "#ffffff"],
    ])
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});
