import { useEffect, useState } from "react";
import { toast } from "sonner";

import type {
  Asset,
  Chapter,
  Character,
  Project,
  Scene,
  SceneGenerationReferences,
  SceneMediaGeneration,
  Storyboard,
  StoryboardMediaGeneration,
} from "../api";
import {
  assetApi,
  chapterApi,
  characterApi,
  projectApi,
  sceneApi,
} from "../api";
import { sceneMediaToWorkspaceMedia, sceneToWorkspaceClip } from "./Workspace.helpers";

export function useWorkspaceData() {
  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
  const [mediaGenerations, setMediaGenerations] = useState<StoryboardMediaGeneration[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [selectedShot, setSelectedShot] = useState<Storyboard | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<number[]>([]);
  const [generationReferences, setGenerationReferences] =
    useState<SceneGenerationReferences | null>(null);
  const [isLoadingGenerationReferences, setIsLoadingGenerationReferences] = useState(false);
  const [generationReferenceError, setGenerationReferenceError] = useState("");
  const [projectCharacters, setProjectCharacters] = useState<Character[]>([]);
  const [projectAssets, setProjectAssets] = useState<Asset[]>([]);
  const [isLoadingProjectCharacters, setIsLoadingProjectCharacters] = useState(false);
  const [isLoadingProjectAssets, setIsLoadingProjectAssets] = useState(false);

  const resolveProjectId = () => {
    const url = new URL(window.location.href);
    const fromQuery = Number(url.searchParams.get("project") ?? "0");
    const fromStorage = Number(window.localStorage.getItem("currentProjectId") ?? "0");
    return fromQuery || fromStorage || 0;
  };

  const loadStoryboards = async (sceneId: number) => {
    try {
      const scene = await sceneApi.getScene(sceneId);
      const clip = sceneToWorkspaceClip(scene);
      applySceneUpdate(scene);
      setStoryboards([clip]);
      setSelectedShot(clip);
    } catch (error) {
      console.error("Failed to load storyboards:", error);
      setStoryboards([]);
      setSelectedShot(null);
    }
  };

  const loadMediaGenerations = async (sceneId: number) => {
    try {
      const data = await sceneApi.getSceneMediaGenerations(sceneId);
      setMediaGenerations(data.map(sceneMediaToWorkspaceMedia));
    } catch (error) {
      console.error("Failed to load media generations:", error);
      setMediaGenerations([]);
    }
  };

  const loadGenerationReferences = async (sceneId: number) => {
    setIsLoadingGenerationReferences(true);
    setGenerationReferenceError("");
    try {
      const data = await sceneApi.getSceneGenerationReferences(sceneId);
      setGenerationReferences(data);
    } catch (error) {
      console.error("Failed to load generation references:", error);
      setGenerationReferences(null);
      setGenerationReferenceError(
        error instanceof Error ? error.message : "真实生成参考读取失败，请重试",
      );
    } finally {
      setIsLoadingGenerationReferences(false);
    }
  };

  useEffect(() => {
    if (selectedShot?.id) {
      void loadGenerationReferences(selectedShot.id);
    } else {
      setGenerationReferences(null);
      setGenerationReferenceError("");
    }
  }, [selectedShot?.id]);

  useEffect(() => {
    if (selectedShot?.id) {
      void loadMediaGenerations(selectedShot.id);
    } else {
      setMediaGenerations([]);
    }
  }, [selectedShot?.id]);

  const applyClipSceneUpdate = (nextScene: Scene) => {
    const clip = sceneToWorkspaceClip(nextScene);
    applySceneUpdate(nextScene);
    setStoryboards([clip]);
    setSelectedShot(clip);
  };

  const applySceneUpdate = (nextScene: Scene) => {
    setScenes((prev) => prev.map((scene) => (scene.id === nextScene.id ? nextScene : scene)));
    setSelectedScene((prev) => (prev?.id === nextScene.id ? nextScene : prev));
  };

  const applyProjectUpdate = (nextProject: Project) => {
    setSelectedProject((prev) => (prev?.id === nextProject.id ? nextProject : prev));
  };

  const applyStoryboardsRefresh = (nextStoryboards: Storyboard[]) => {
    setStoryboards(nextStoryboards);
    setSelectedShot((prev) => {
      if (!nextStoryboards.length) {
        return null;
      }
      if (!prev) {
        return nextStoryboards[0] ?? null;
      }
      return nextStoryboards.find((shot) => shot.id === prev.id) ?? nextStoryboards[0] ?? null;
    });
  };

  const applyMediaMutation = (payload: {
    scene: Scene;
    media_generations: SceneMediaGeneration[];
  }) => {
    applyClipSceneUpdate(payload.scene);
    setMediaGenerations(payload.media_generations.map(sceneMediaToWorkspaceMedia));
  };

  const loadProjectCharacters = async (projectId: number) => {
    setIsLoadingProjectCharacters(true);
    try {
      const data = await characterApi.getCharactersByProject(projectId);
      setProjectCharacters(data);
    } catch (error) {
      console.error("Failed to load project characters:", error);
      toast.error(error instanceof Error ? error.message : "加载项目角色失败");
      setProjectCharacters([]);
    } finally {
      setIsLoadingProjectCharacters(false);
    }
  };

  const loadProjectAssets = async (projectId: number) => {
    setIsLoadingProjectAssets(true);
    try {
      const data = await assetApi.getAssetsByProject(projectId);
      setProjectAssets(data || []);
    } catch (error) {
      console.error("Failed to load project assets:", error);
      toast.error(error instanceof Error ? error.message : "加载项目资产失败");
      setProjectAssets([]);
    } finally {
      setIsLoadingProjectAssets(false);
    }
  };

  const loadScenes = async (chapterId: number, autoSelect = false) => {
    try {
      const data = await sceneApi.getScenesByChapter(chapterId);
      setScenes(data);

      if (autoSelect) {
        const firstScene = data[0] ?? null;
        setSelectedScene(firstScene);
        if (firstScene) {
          await loadStoryboards(firstScene.id);
        } else {
          setStoryboards([]);
          setSelectedShot(null);
        }
      } else {
        setSelectedScene((prev) => {
          if (!prev) return prev;
          return data.find((scene) => scene.id === prev.id) ?? prev;
        });
      }
    } catch (error) {
      console.error("Failed to load scenes:", error);
      setScenes([]);
      if (autoSelect) {
        setSelectedScene(null);
        setStoryboards([]);
        setSelectedShot(null);
      }
    }
  };

  const loadChapters = async (projectId: number, autoSelect = false) => {
    try {
      const data = await chapterApi.getChaptersByProject(projectId);
      setChapters(data);

      if (autoSelect) {
        const firstChapter = data[0] ?? null;
        setSelectedChapter(firstChapter);
        setExpandedChapters(firstChapter ? [firstChapter.id] : []);
        if (firstChapter) {
          await loadScenes(firstChapter.id, true);
        } else {
          setScenes([]);
          setSelectedScene(null);
          setStoryboards([]);
          setSelectedShot(null);
        }
      }
    } catch (error) {
      console.error("Failed to load chapters:", error);
      setChapters([]);
      if (autoSelect) {
        setSelectedChapter(null);
        setScenes([]);
        setSelectedScene(null);
        setStoryboards([]);
        setSelectedShot(null);
      }
    }
  };

  const applyProjectSelection = async (projectId: number, projectList: Project[]) => {
    const project = projectList.find((p) => p.id === projectId);
    if (!project) {
      return;
    }

    window.localStorage.setItem("currentProjectId", String(projectId));
    setSelectedProject(project);
    await Promise.all([
      loadChapters(projectId, true),
      loadProjectCharacters(projectId),
      loadProjectAssets(projectId),
    ]);
  };

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await projectApi.getProjects();
      const projectId = resolveProjectId();
      if (projectId) {
        await applyProjectSelection(projectId, data);
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleChapter = async (chapterId: number) => {
    const isExpanded = expandedChapters.includes(chapterId);
    const chapter = chapters.find((c) => c.id === chapterId);
    if (!chapter) {
      return;
    }

    if (isExpanded) {
      setExpandedChapters((prev) => prev.filter((id) => id !== chapterId));
      setSelectedChapter(null);
      setScenes([]);
      setSelectedScene(null);
      setStoryboards([]);
      setSelectedShot(null);
      return;
    }

    setExpandedChapters([chapterId]);
    setSelectedChapter(chapter);
    await loadScenes(chapter.id, true);
  };

  const selectScene = async (scene: Scene) => {
    setSelectedScene(scene);
    await loadStoryboards(scene.id);
  };

  return {
    loading,
    setLoading,
    chapters,
    setChapters,
    scenes,
    setScenes,
    storyboards,
    setStoryboards,
    mediaGenerations,
    setMediaGenerations,
    selectedProject,
    setSelectedProject,
    selectedChapter,
    setSelectedChapter,
    selectedScene,
    setSelectedScene,
    selectedShot,
    setSelectedShot,
    expandedChapters,
    setExpandedChapters,
    generationReferences,
    setGenerationReferences,
    isLoadingGenerationReferences,
    setIsLoadingGenerationReferences,
    generationReferenceError,
    setGenerationReferenceError,
    projectCharacters,
    setProjectCharacters,
    projectAssets,
    setProjectAssets,
    isLoadingProjectCharacters,
    setIsLoadingProjectCharacters,
    isLoadingProjectAssets,
    setIsLoadingProjectAssets,
    resolveProjectId,
    loadStoryboards,
    loadMediaGenerations,
    loadGenerationReferences,
    applyClipSceneUpdate,
    applySceneUpdate,
    applyProjectUpdate,
    applyStoryboardsRefresh,
    applyMediaMutation,
    loadProjectCharacters,
    loadProjectAssets,
    loadScenes,
    loadChapters,
    applyProjectSelection,
    loadProjects,
    toggleChapter,
    selectScene,
  };
}

export type WorkspaceData = ReturnType<typeof useWorkspaceData>;
