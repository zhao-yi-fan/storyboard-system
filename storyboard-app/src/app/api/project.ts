import { apiClient } from "./client";
import type { ComposeProjectVideoResult, Project } from "./types";

type RequestBehaviorOptions = {
  suppressToast?: boolean;
};

export function getProjects() {
  return apiClient.get<Project[]>("/projects");
}

export function getProject(id: number) {
  return apiClient.get<Project>(`/projects/${id}`);
}

export function createProject(
  data: { name: string; description?: string },
  options?: RequestBehaviorOptions
) {
  return apiClient.post<Project>("/projects", data, options);
}

export function updateProject(
  id: number,
  data: { name?: string; description?: string; script_text?: string }
) {
  return apiClient.put<Project>(`/projects/${id}`, data);
}

export function deleteProject(id: number) {
  return apiClient.delete<{ success: boolean }>(`/projects/${id}`);
}

export function pinProject(id: number) {
  return apiClient.post<Project>(`/projects/${id}/pin`, {});
}

export function unpinProject(id: number) {
  return apiClient.delete<Project>(`/projects/${id}/pin`);
}

export function importScript(
  id: number,
  scriptText: string,
  options?: RequestBehaviorOptions
) {
  return apiClient.post<{
    project_id: number;
    chapter_count: number;
    scene_count: number;
    storyboard_count: number;
    character_count: number;
  }>(`/projects/${id}/import-script`, {
    script_text: scriptText,
  }, options);
}

export function composeProjectVideo(id: number, data?: { regenerate?: boolean }) {
  return apiClient.post<ComposeProjectVideoResult>(`/projects/${id}/compose-video`, data ?? {});
}
