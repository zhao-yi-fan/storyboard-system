import { apiClient } from "./client";
import type {
  ComposeSceneVideoResult,
  GenerateSceneCoverResult,
  GenerateSceneStoryboardCoversResult,
  Scene,
} from "./types";

export function getScenesByChapter(chapterId: number) {
  return apiClient.get<Scene[]>(`/chapters/${chapterId}/scenes`);
}

export function getScene(id: number) {
  return apiClient.get<Scene>(`/scenes/${id}`);
}

export function createScene(
  chapterId: number,
  data: { title: string; description?: string; location?: string; time_of_day?: string; style_preset?: string; style_notes?: string }
) {
  return apiClient.post<Scene>(`/chapters/${chapterId}/scenes`, data);
}

export function updateScene(
  id: number,
  data: { title?: string; description?: string; location?: string; time_of_day?: string; style_preset?: string; style_notes?: string; sort_order?: number }
) {
  return apiClient.put<Scene>(`/scenes/${id}`, data);
}

export function deleteScene(id: number) {
  return apiClient.delete<{ success: boolean }>(`/scenes/${id}`);
}

export function generateSceneCover(id: number) {
  return apiClient.post<GenerateSceneCoverResult>(`/scenes/${id}/generate-cover`);
}

export function generateSceneStoryboardCovers(id: number) {
  return apiClient.post<GenerateSceneStoryboardCoversResult>(`/scenes/${id}/generate-storyboard-covers`);
}

export function composeSceneVideo(id: number, data?: { regenerate?: boolean }) {
  return apiClient.post<ComposeSceneVideoResult>(`/scenes/${id}/compose-video`, data ?? {});
}
