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
  options?: RequestBehaviorOptions,
) {
  return apiClient.post<Project>("/projects", data, options);
}

export function updateProject(
  id: number,
  data: { name?: string; description?: string; script_text?: string },
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

export type ScriptImportResume = {
  resume_from_chunk?: number;
  text_hash?: string;
};

export type ScriptImportResult = {
  project_id: number;
  chunk_count: number;
  completed_chunks: number;
  chapter_count: number;
  scene_count: number;
  storyboard_count: number;
  character_count: number;
};

export type ScriptImportResumeInfo = {
  completed_chunks: number;
  total_chunks: number;
  skipped_chunks: number;
  text_hash: string;
};

export function importScript(
  id: number,
  scriptText: string,
  options?: RequestBehaviorOptions,
  resume?: ScriptImportResume,
) {
  return apiClient.post<ScriptImportResult>(
    `/projects/${id}/import-script`,
    {
      script_text: scriptText,
      resume_from_chunk: resume?.resume_from_chunk,
      text_hash: resume?.text_hash,
    },
    options,
  );
}

export function composeProjectVideo(id: number, data?: { regenerate?: boolean }) {
  return apiClient.post<ComposeProjectVideoResult>(`/projects/${id}/compose-video`, data ?? {});
}
