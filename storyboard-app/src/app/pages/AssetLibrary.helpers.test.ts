import { describe, expect, it } from "vitest";

import type { Asset, Character } from "../api";
import {
  CHARACTER_GENERATION_COPY,
  getAssetOriginalSrc,
  getCharacterDesignSheetPreviewSrc,
  getCharacterPreviewSrc,
  getCharacterReferenceSrc,
  getCharacterVoiceReferenceSrc,
  hasCharacterVoiceReference,
} from "./AssetLibrary.helpers";

const character = (overrides: Partial<Character> = {}) =>
  ({
    id: 1,
    design_sheet_url: "https://cdn.example.com/design.png",
    avatar_url: "https://cdn.example.com/avatar.png",
    voice_reference_url: "",
    ...overrides,
  }) as Character;

describe("character preview sources", () => {
  it("design sheet and preview share design_sheet_url", () => {
    expect(getCharacterPreviewSrc(character())).toBe("https://cdn.example.com/design.png");
    expect(getCharacterDesignSheetPreviewSrc(character())).toBe(
      "https://cdn.example.com/design.png",
    );
  });

  it("reference uses avatar, voice uses voice_reference_url", () => {
    expect(getCharacterReferenceSrc(character())).toBe("https://cdn.example.com/avatar.png");
    expect(getCharacterVoiceReferenceSrc(character())).toBe("");
    expect(
      getCharacterVoiceReferenceSrc(character({ voice_reference_url: "https://x/v.mp3" })),
    ).toBe("https://x/v.mp3");
  });

  it("empty input yields empty string", () => {
    expect(getCharacterPreviewSrc(null)).toBe("");
    expect(getCharacterPreviewSrc(undefined)).toBe("");
    expect(getCharacterReferenceSrc(null)).toBe("");
  });
});

describe("hasCharacterVoiceReference", () => {
  it("is boolean", () => {
    expect(hasCharacterVoiceReference(character())).toBe(false);
    expect(hasCharacterVoiceReference(character({ voice_reference_url: "https://x/v.mp3" }))).toBe(
      true,
    );
    expect(hasCharacterVoiceReference(null)).toBe(false);
  });
});

describe("asset helpers", () => {
  it("getAssetOriginalSrc falls back to empty", () => {
    expect(getAssetOriginalSrc({ file_url: "https://x/a.png" } as Asset)).toBe("https://x/a.png");
    expect(getAssetOriginalSrc(null)).toBe("");
  });

  it("generation copy is frozen content", () => {
    expect(CHARACTER_GENERATION_COPY.DESIGN_SHEET_MODEL_LABEL).toContain("Seedream");
    expect(CHARACTER_GENERATION_COPY.VOICE_REFERENCE_TEXT.length).toBeGreaterThan(0);
  });
});
