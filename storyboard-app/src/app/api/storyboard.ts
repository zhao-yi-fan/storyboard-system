import { apiClient } from "./client";
import type { Storyboard } from "../api/types";

// 获取场景下所有分镜镜头
export function getStoryboardsByScene(sceneId: number) {
  return apiClient.get<Storyboard[]>(`/scenes/${sceneId}/storyboards`);
}

// 获取单个分镜镜头详情
export function getStoryboard(id: number) {
  return apiClient.get<Storyboard>(`/storyboards/${id}`);
}

// 创建分镜镜头
export function createStoryboard(
  sceneId: number,
  data: {
    shot_number?: number;
    content: string;
    camera_direction?: string;
    duration?: number;
    background?: string;
    thumbnail_url?: string;
    notes?: string;
  }
) {
  return apiClient.post<Storyboard>(`/scenes/${sceneId}/storyboards`, data);
}

// 更新分镜镜头
export function updateStoryboard(
  id: number,
  data: {
    shot_number?: number;
    content?: string;
    camera_direction?: string;
    duration?: number;
    background?: string;
    thumbnail_url?: string;
    notes?: string;
    sort_order?: number;
  }
) {
  return apiClient.put<Storyboard>(`/storyboards/${id}`, data);
}

// 删除分镜镜头
export function deleteStoryboard(id: number) {
  return apiClient.delete<{ success: boolean }>(`/storyboards/${id}`);
}
