import { apiClient } from "./client";
import type { Chapter } from "./types";

// 获取项目下所有章节
export function getChaptersByProject(projectId: number) {
  return apiClient.get<Chapter[]>(`/projects/${projectId}/chapters`);
}

// 获取单个章节详情
export function getChapter(id: number) {
  return apiClient.get<Chapter>(`/chapters/${id}`);
}

// 创建章节
export function createChapter(
  projectId: number,
  data: { title: string; summary?: string }
) {
  return apiClient.post<Chapter>(`/projects/${projectId}/chapters`, data);
}

// 更新章节
export function updateChapter(
  id: number,
  data: { title?: string; summary?: string; sort_order?: number }
) {
  return apiClient.put<Chapter>(`/chapters/${id}`, data);
}

// 删除章节
export function deleteChapter(id: number) {
  return apiClient.delete<{ success: boolean }>(`/chapters/${id}`);
}
