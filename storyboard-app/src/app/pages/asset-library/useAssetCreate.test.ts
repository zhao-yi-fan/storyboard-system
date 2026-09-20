import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { assetApi, characterApi, ossApi } from "../../api";
import { ASSET_KIND } from "../../constants/domain";
import { useAssetCreate } from "./useAssetCreate";

vi.mock("../../api", () => ({
  characterApi: { createCharacter: vi.fn() },
  assetApi: { createAsset: vi.fn() },
  ossApi: { uploadFileToOss: vi.fn() },
}));

const deps = {
  currentProjectId: 19,
  activeTab: "characters" as never,
  loadCharacters: vi.fn(),
  loadAssets: vi.fn(),
  setActiveTab: vi.fn(),
  setSelectedAsset: vi.fn(),
};

describe("useAssetCreate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects empty character names without calling the api", async () => {
    const { result } = renderHook(() => useAssetCreate({ ...deps }));
    await act(async () => {
      await result.current.handleCreate();
    });
    expect(characterApi.createCharacter).not.toHaveBeenCalled();
  });

  it("creates a character and refreshes the list", async () => {
    vi.mocked(characterApi.createCharacter).mockResolvedValue({ id: 1 } as never);
    const { result } = renderHook(() => useAssetCreate({ ...deps }));
    act(() => {
      result.current.setNewCharacter({ name: "林婉", description: "", avatar_url: "" });
    });
    await act(async () => {
      await result.current.handleCreate();
    });
    expect(characterApi.createCharacter).toHaveBeenCalledWith(
      19,
      expect.objectContaining({ name: "林婉" }),
    );
    expect(deps.loadCharacters).toHaveBeenCalledTimes(1);
    expect(result.current.showCreateDialog).toBe(false);
  });

  it("switches asset mode and presets the draft type", () => {
    const { result } = renderHook(() => useAssetCreate({ ...deps }));
    act(() => {
      result.current.selectCreateMode(ASSET_KIND.PROP);
    });
    expect(result.current.newAsset.type).toBe(ASSET_KIND.PROP);
  });

  it("uploads the picked file on asset create", async () => {
    vi.mocked(ossApi.uploadFileToOss).mockResolvedValue("https://oss/x.png");
    vi.mocked(assetApi.createAsset).mockResolvedValue({ id: 2 } as never);
    const { result } = renderHook(() => useAssetCreate({ ...deps }));
    act(() => {
      result.current.selectCreateMode(ASSET_KIND.SCENE);
      result.current.setNewAsset({ name: "店", type: "scene", meta: "", file_url: "" });
      result.current.setCreateAssetFile(new File(["x"], "a.png", { type: "image/png" }));
    });
    await act(async () => {
      await result.current.handleCreate();
    });
    expect(ossApi.uploadFileToOss).toHaveBeenCalledTimes(1);
    expect(assetApi.createAsset).toHaveBeenCalledWith(
      19,
      expect.objectContaining({ file_url: "https://oss/x.png" }),
    );
  });

  it("does nothing without a project", async () => {
    const { result } = renderHook(() => useAssetCreate({ ...deps, currentProjectId: 0 }));
    await act(async () => {
      await result.current.handleCreate();
    });
    expect(characterApi.createCharacter).not.toHaveBeenCalled();
    expect(assetApi.createAsset).not.toHaveBeenCalled();
  });
});
