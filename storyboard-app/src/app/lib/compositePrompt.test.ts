import { describe, expect, it } from "vitest";

import type { Scene, Storyboard } from "../api";
import {
  buildLegacyCompositePrompt,
  COMPOSITE_PROMPT_SPEC,
  isCompositeStoryboardPrompt,
} from "./compositePrompt";

const shot = (overrides: Partial<Storyboard> = {}) =>
  ({
    id: 1,
    shot_number: 2,
    content: "李明抬头看天",
    duration: 5,
    character_names: ["李明"],
    characters: [],
    asset_names: [],
    assets: [],
    ...overrides,
  }) as Storyboard;

const scene = (overrides: Partial<Scene> = {}) =>
  ({
    id: 1,
    title: "便利店门口",
    ...overrides,
  }) as Scene;

describe("isCompositeStoryboardPrompt", () => {
  it("detects composite markers", () => {
    expect(isCompositeStoryboardPrompt("镜号：1\n[画面]：远景")).toBe(true);
    expect(isCompositeStoryboardPrompt("镜号: 2\n[要求]: 写实")).toBe(true);
  });

  it("rejects plain and empty input", () => {
    expect(isCompositeStoryboardPrompt("李明抬头看天")).toBe(false);
    expect(isCompositeStoryboardPrompt("镜号：1 只有镜号")).toBe(false);
    expect(isCompositeStoryboardPrompt(null)).toBe(false);
    expect(isCompositeStoryboardPrompt("")).toBe(false);
  });
});

describe("buildLegacyCompositePrompt", () => {
  it("passes composite prompts through untouched", () => {
    const raw = "镜号：1\n[画面]：远景";
    expect(buildLegacyCompositePrompt(shot({ content: raw }), scene())).toBe(raw);
  });

  it("builds a shot line with number and content", () => {
    const prompt = buildLegacyCompositePrompt(shot(), scene());
    expect(prompt).toContain("镜号：2");
    expect(prompt).toContain("李明抬头看天");
    expect(prompt).toContain("@李明");
  });

  it("clamps out-of-range duration to 5s", () => {
    expect(buildLegacyCompositePrompt(shot({ duration: 99 }), scene())).toContain("[0-5s]");
    expect(buildLegacyCompositePrompt(shot({ duration: 8 }), scene())).toContain("[0-8s]");
  });

  it("spec caps length", () => {
    expect(COMPOSITE_PROMPT_SPEC.MAX_LENGTH).toBe(10000);
  });
});
