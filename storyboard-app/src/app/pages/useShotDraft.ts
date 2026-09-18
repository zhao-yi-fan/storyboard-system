import { useState } from "react";
import { toast } from "sonner";

import type { Scene, Storyboard } from "../api";
import { sceneApi } from "../api";
import { COMPOSITE_PROMPT_SPEC } from "../lib/compositePrompt";
import type { ShotFormState } from "./Workspace.helpers";
import { buildShotFormState } from "./Workspace.helpers";

type UseShotDraftDeps = {
  selectedShot: Storyboard | null;
  selectedScene: Scene | null;
  shotForm: ShotFormState;
  getActiveVideoDuration: () => number;
  applyClipSceneUpdate: (scene: Scene) => void;
};

export function useShotDraft({
  selectedShot,
  selectedScene,
  shotForm,
  getActiveVideoDuration,
  applyClipSceneUpdate,
}: UseShotDraftDeps) {
  const [isSavingShot, setIsSavingShot] = useState(false);

  const buildShotUpdatePayload = () => ({
    content: shotForm.content,
  });

  const isShotDraftDirty = () => {
    if (!selectedShot) return false;
    const persisted = buildShotFormState(selectedShot, selectedScene);
    return (Object.keys(shotForm) as Array<keyof ShotFormState>).some(
      (key) => shotForm[key] !== persisted[key],
    );
  };

  const saveShotDraft = async (onlyWhenDirty = false) => {
    if (!selectedShot) return false;
    if (onlyWhenDirty && !isShotDraftDirty()) return true;
    if (shotForm.content.length > COMPOSITE_PROMPT_SPEC.MAX_LENGTH) {
      toast.error(`提示词最多支持 ${COMPOSITE_PROMPT_SPEC.MAX_LENGTH} 个字符`);
      return false;
    }

    setIsSavingShot(true);
    try {
      const nextScene = await sceneApi.updateScene(selectedShot.id, {
        prompt: buildShotUpdatePayload().content,
        generation_duration: getActiveVideoDuration(),
      });
      applyClipSceneUpdate(nextScene);
      return true;
    } catch (error) {
      console.error("Failed to save storyboard:", error);
      toast.error(error instanceof Error ? error.message : "片段保存失败，已停止生成");
      return false;
    } finally {
      setIsSavingShot(false);
    }
  };

  const saveShotDraftBeforeGeneration = () => saveShotDraft(true);

  const handleSaveShot = async () => {
    await saveShotDraft();
  };

  return {
    isSavingShot,
    saveShotDraft,
    saveShotDraftBeforeGeneration,
    handleSaveShot,
  };
}
