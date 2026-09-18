import { useState } from "react";
import { toast } from "sonner";

import type {
  Project,
  Scene,
  SceneMediaGeneration,
  Storyboard,
  StoryboardMediaGeneration,
} from "../api";
import { projectApi, sceneApi } from "../api";
import { GENERATION_STATUS } from "../constants/domain";

type UseWorkspaceSceneMediaDeps = {
  selectedProject: Project | null;
  selectedScene: Scene | null;
  selectedShot: Storyboard | null;
  frameExtractionGeneration: StoryboardMediaGeneration | null;
  setSelectedShot: (shot: Storyboard | null) => void;
  setMediaGenerations: (generations: StoryboardMediaGeneration[]) => void;
  applySceneUpdate: (scene: Scene) => void;
  applyClipSceneUpdate: (scene: Scene) => void;
  applyProjectUpdate: (project: Project) => void;
  applyStoryboardsRefresh: (storyboards: Storyboard[]) => void;
  applyMediaMutation: (payload: {
    scene: Scene;
    media_generations: SceneMediaGeneration[];
  }) => void;
  loadMediaGenerations: (sceneId: number) => Promise<void>;
  loadGenerationReferences: (sceneId: number) => Promise<void>;
};

export function useWorkspaceSceneMedia({
  selectedProject,
  selectedScene,
  selectedShot,
  frameExtractionGeneration,
  setSelectedShot,
  setMediaGenerations,
  applySceneUpdate,
  applyClipSceneUpdate,
  applyProjectUpdate,
  applyStoryboardsRefresh,
  applyMediaMutation,
  loadMediaGenerations,
  loadGenerationReferences,
}: UseWorkspaceSceneMediaDeps) {
  const [isSceneCoverConfirmOpen, setIsSceneCoverConfirmOpen] = useState(false);
  const [isBatchSceneCoverConfirmOpen, setIsBatchSceneCoverConfirmOpen] = useState(false);
  const [isSceneVideoConfirmOpen, setIsSceneVideoConfirmOpen] = useState(false);
  const [isProjectVideoConfirmOpen, setIsProjectVideoConfirmOpen] = useState(false);
  const [isComposingProjectVideo, setIsComposingProjectVideo] = useState(false);
  const [, setIsGeneratingSceneCover] = useState(false);
  const [, setIsBatchGeneratingSceneCover] = useState(false);
  const [, setIsComposingSceneVideo] = useState(false);
  const [deleteTargetGeneration, setDeleteTargetGeneration] =
    useState<StoryboardMediaGeneration | null>(null);
  const [activeMediaActionKey, setActiveMediaActionKey] = useState<string | null>(null);

  const runGenerateSceneCover = async () => {
    if (!selectedScene) {
      return;
    }

    setIsGeneratingSceneCover(true);
    try {
      const result = await sceneApi.generateSceneCover(selectedScene.id);
      applySceneUpdate(result.scene);
      toast.success("片段封面生成完成");
    } catch (error) {
      console.error("Failed to generate scene cover:", error);
    } finally {
      setIsGeneratingSceneCover(false);
    }
  };

  const confirmGenerateSceneCover = async () => {
    setIsSceneCoverConfirmOpen(false);
    await runGenerateSceneCover();
  };

  const runBatchGenerateSceneCovers = async () => {
    if (!selectedScene) {
      return;
    }

    const currentShotId = selectedShot?.id ?? null;
    setIsBatchGeneratingSceneCover(true);
    try {
      const result = await sceneApi.generateSceneStoryboardCovers(selectedScene.id);
      applySceneUpdate(result.scene);
      applyStoryboardsRefresh(result.storyboards);
      if (currentShotId) {
        const refreshedSelected = result.storyboards.find((shot) => shot.id === currentShotId);
        if (refreshedSelected) {
          setSelectedShot(refreshedSelected);
          await loadMediaGenerations(refreshedSelected.id);
        } else {
          setMediaGenerations([]);
        }
      }
      if (result.generated_count > 0) {
        toast.success(`已为 ${result.generated_count} 个镜头生成首帧`);
      }
      if (result.failed.length > 0) {
        toast.error(`${result.failed.length} 个镜头首帧生成失败`);
      }
    } catch (error) {
      console.error("Failed to batch generate storyboard covers:", error);
    } finally {
      setIsBatchGeneratingSceneCover(false);
    }
  };

  const confirmBatchGenerateSceneCovers = async () => {
    setIsBatchSceneCoverConfirmOpen(false);
    await runBatchGenerateSceneCovers();
  };

  const runComposeSceneVideo = async () => {
    if (!selectedScene) {
      return;
    }

    setIsComposingSceneVideo(true);
    try {
      const result = await sceneApi.composeSceneVideo(selectedScene.id);
      applySceneUpdate(result.scene);
      toast.success("片段视频合成完成");
    } catch (error) {
      console.error("Failed to compose scene video:", error);
    } finally {
      setIsComposingSceneVideo(false);
    }
  };

  const confirmComposeSceneVideo = async () => {
    setIsSceneVideoConfirmOpen(false);
    await runComposeSceneVideo();
  };

  const handleComposeProjectVideo = () => {
    if (!selectedProject || isComposingProjectVideo) {
      return;
    }
    setIsProjectVideoConfirmOpen(true);
  };

  const runComposeProjectVideo = async () => {
    if (!selectedProject) {
      return;
    }

    setIsComposingProjectVideo(true);
    try {
      const result = await projectApi.composeProjectVideo(selectedProject.id);
      applyProjectUpdate(result.project);
      toast.success("项目总片合成完成");
    } catch (error) {
      console.error("Failed to compose project video:", error);
    } finally {
      setIsComposingProjectVideo(false);
    }
  };

  const confirmComposeProjectVideo = async () => {
    setIsProjectVideoConfirmOpen(false);
    await runComposeProjectVideo();
  };

  const handleSetCurrentGeneration = async (generation: StoryboardMediaGeneration) => {
    if (!selectedShot) {
      return;
    }
    if (generation.status !== GENERATION_STATUS.SUCCEEDED || !generation.result_url) {
      toast.error("该版本尚未生成成功，不能设为当前版本");
      return;
    }
    const actionKey = `set-current:${generation.id}`;
    setActiveMediaActionKey(actionKey);
    try {
      const result = await sceneApi.setSceneMediaGenerationCurrent(selectedShot.id, generation.id);
      applyMediaMutation(result);
    } catch (error) {
      console.error("Failed to set current media generation:", error);
    } finally {
      setActiveMediaActionKey(null);
    }
  };

  const handleRequestDeleteGeneration = (generation: StoryboardMediaGeneration) => {
    setDeleteTargetGeneration(generation);
  };

  const confirmDeleteGeneration = async () => {
    if (!selectedShot || !deleteTargetGeneration) {
      return;
    }

    const actionKey = `delete:${deleteTargetGeneration.id}`;
    setActiveMediaActionKey(actionKey);
    try {
      const result = await sceneApi.deleteSceneMediaGeneration(
        selectedShot.id,
        deleteTargetGeneration.id,
      );
      applyMediaMutation(result);
    } catch (error) {
      console.error("Failed to delete media generation:", error);
    } finally {
      setActiveMediaActionKey(null);
      setDeleteTargetGeneration(null);
    }
  };

  const handleInsertVideoFrame = async (file: File, timestampMs: number, targetScene: Scene) => {
    if (!selectedScene || !frameExtractionGeneration) {
      throw new Error("抽帧来源不可用");
    }
    const frame = await sceneApi.createSceneVideoFrame(
      selectedScene.id,
      frameExtractionGeneration.id,
      { file, timestampMs, targetSceneId: targetScene.id },
    );
    await loadMediaGenerations(selectedScene.id);
    if (targetScene.id === selectedScene.id) {
      const refreshed = await sceneApi.getScene(selectedScene.id);
      applyClipSceneUpdate(refreshed);
      await loadGenerationReferences(selectedScene.id);
    }
    toast.success(`已将抽帧作为「${targetScene.title}」的参考图`);
    return frame;
  };

  const handleCreateVideoClip = async (startMs: number, endMs: number) => {
    if (!selectedScene || !frameExtractionGeneration) {
      throw new Error("视频来源不可用");
    }
    const result = await sceneApi.createSceneVideoClip(
      selectedScene.id,
      frameExtractionGeneration.id,
      { startMs, endMs },
    );
    applyMediaMutation(result);
    toast.success("截取视频已保存到视频版本");
  };

  return {
    isSceneCoverConfirmOpen,
    setIsSceneCoverConfirmOpen,
    isBatchSceneCoverConfirmOpen,
    setIsBatchSceneCoverConfirmOpen,
    isSceneVideoConfirmOpen,
    setIsSceneVideoConfirmOpen,
    isProjectVideoConfirmOpen,
    setIsProjectVideoConfirmOpen,
    isComposingProjectVideo,
    deleteTargetGeneration,
    setDeleteTargetGeneration,
    activeMediaActionKey,
    runGenerateSceneCover,
    confirmGenerateSceneCover,
    runBatchGenerateSceneCovers,
    confirmBatchGenerateSceneCovers,
    runComposeSceneVideo,
    confirmComposeSceneVideo,
    handleComposeProjectVideo,
    runComposeProjectVideo,
    confirmComposeProjectVideo,
    handleSetCurrentGeneration,
    handleRequestDeleteGeneration,
    confirmDeleteGeneration,
    handleInsertVideoFrame,
    handleCreateVideoClip,
  };
}
