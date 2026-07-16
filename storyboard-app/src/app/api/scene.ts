import { apiClient } from "./client";
import type {
  AIGenerationPreview,
  ComposeSceneVideoResult,
  GenerateSceneCoverResult,
  GenerateSceneStoryboardCoversResult,
  Scene,
  SceneGenerationReferences,
  SceneMediaGeneration,
  SceneMediaMutationResult,
  StoryboardCoverGenerationPreview,
  StoryboardVideoGenerationOptions,
  StoryboardVideoGenerationPreview,
  StoryboardDirectionAnalysis,
} from "./types";

export function getScenesByChapter(chapterId: number) {
  return apiClient.get<Scene[]>(`/chapters/${chapterId}/scenes`);
}

export function getScene(id: number) {
  return apiClient.get<Scene>(`/scenes/${id}`);
}

export function createScene(
  chapterId: number,
  data: {
    title: string;
    description?: string;
    prompt?: string;
    location?: string;
    time_of_day?: string;
    style_preset?: string;
    style_notes?: string;
    sort_order?: number;
  },
) {
  return apiClient.post<Scene>(`/chapters/${chapterId}/scenes`, data);
}

export function updateScene(
  id: number,
  data: {
    title?: string;
    description?: string;
    prompt?: string;
    location?: string;
    time_of_day?: string;
    style_preset?: string;
    style_notes?: string;
    sort_order?: number;
    generation_duration?: number;
  },
) {
  return apiClient.put<Scene>(`/scenes/${id}`, data);
}

export function deleteScene(id: number) {
  return apiClient.delete<{ success: boolean }>(`/scenes/${id}`);
}

export function getSceneCoverGenerationPreview(id: number) {
  return apiClient.get<AIGenerationPreview>(`/scenes/${id}/cover-generation-preview`);
}

export function generateSceneCover(id: number) {
  return apiClient.post<GenerateSceneCoverResult>(`/scenes/${id}/generate-cover`);
}

export function generateSceneStoryboardCovers(id: number) {
  return apiClient.post<GenerateSceneStoryboardCoversResult>(
    `/scenes/${id}/generate-storyboard-covers`,
  );
}

export function composeSceneVideo(id: number, data?: { regenerate?: boolean }) {
  return apiClient.post<ComposeSceneVideoResult>(`/scenes/${id}/compose-video`, data ?? {});
}

export function getSceneMediaGenerations(id: number) {
  return apiClient.get<SceneMediaGeneration[]>(`/scenes/${id}/media-generations`);
}

export function setSceneMediaGenerationCurrent(id: number, generationId: number) {
  return apiClient.post<SceneMediaMutationResult>(
    `/scenes/${id}/media-generations/${generationId}/set-current`,
  );
}

export function deleteSceneMediaGeneration(id: number, generationId: number) {
  return apiClient.delete<SceneMediaMutationResult>(
    `/scenes/${id}/media-generations/${generationId}`,
  );
}

export function getSceneClipCoverGenerationPreview(id: number, model = "seedream-4.5") {
  const query = new URLSearchParams({ model });
  return apiClient.get<StoryboardCoverGenerationPreview>(
    `/scenes/${id}/cover-generation-preview?${query.toString()}`,
  );
}

export function getSceneGenerationReferences(id: number) {
  return apiClient.get<SceneGenerationReferences>(`/scenes/${id}/generation-references`);
}

export function generateSceneClipCover(
  id: number,
  data: { model?: string; use_text_only?: boolean } = {},
) {
  return apiClient.post<GenerateSceneCoverResult>(`/scenes/${id}/generate-cover`, data);
}

export function uploadSceneCover(id: number, coverUrl: string) {
  return apiClient.post<SceneMediaMutationResult>(`/scenes/${id}/upload-cover`, {
    cover_url: coverUrl,
  });
}

export function getSceneVideoGenerationPreview(
  id: number,
  options: StoryboardVideoGenerationOptions,
) {
  const query = new URLSearchParams();
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) query.set(key, String(value));
  });
  return apiClient.get<StoryboardVideoGenerationPreview>(
    `/scenes/${id}/video-generation-preview?${query.toString()}`,
  );
}

export function generateSceneVideo(id: number, options: StoryboardVideoGenerationOptions) {
  return apiClient.post<{ scene_id: number; scene: Scene }>(
    `/scenes/${id}/generate-video`,
    options,
  );
}

export function addSceneCharacter(id: number, characterId: number) {
  return apiClient.post<Scene>(`/scenes/${id}/characters`, { character_id: characterId });
}

export function removeSceneCharacter(id: number, characterId: number) {
  return apiClient.delete<Scene>(`/scenes/${id}/characters/${characterId}`);
}

export function addSceneAsset(id: number, assetId: number) {
  return apiClient.post<Scene>(`/scenes/${id}/assets`, { asset_id: assetId });
}

export function removeSceneAsset(id: number, assetId: number) {
  return apiClient.delete<Scene>(`/scenes/${id}/assets/${assetId}`);
}

export function getSceneShotDirectionAnalyses(id: number) {
  return apiClient.get<StoryboardDirectionAnalysis[]>(`/scenes/${id}/shot-direction-analyses`);
}

export function analyzeSceneShotDirections(id: number) {
  return apiClient.post<StoryboardDirectionAnalysis[]>(`/scenes/${id}/analyze-shot-directions`);
}
