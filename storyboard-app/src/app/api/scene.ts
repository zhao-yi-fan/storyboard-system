import { apiClient } from "./client";
import type { Scene } from "./types";

// 获取章节下所有场景
export function getScenesByChapter(chapterId: number) {
  return apiClient.get<Scene[]>(`/chapters/${chapterId}/scenes`);
}

// 获取单个场景详情
export function getScene(id: number) {
  return apiClient.get<Scene>(`/scenes/${id}`);
}

// 创建场景
export function createScene(
  chapterId: number,
  data: { title: string; description?: string; location?: string; time_of_day?: string }
) {
  return apiClient.post<Scene>(`/chapters/${chapterId}/scenes`, data);
}

// 更新场景
export function updateScene(
  id: number,
  data: { title?: string; description?: string; location?: string; time_of_day?: string; sort_order?: number }
) {
  return apiClient.put<Scene>(`/scenes/${id}`, data);
}

// 删除场景
export function deleteScene(id: number) {
  return apiClient.delete<{ success: boolean }>(`/scenes/${id}`);
}
