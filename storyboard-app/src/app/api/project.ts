import { apiClient } from "./client";
import type { Project } from "./types";

// 获取所有项目列表
export function getProjects() {
  return apiClient.get<Project[]>("/projects");
}

// 获取单个项目详情
export function getProject(id: number) {
  return apiClient.get<Project>(`/projects/${id}`);
}

// 创建新项目
export function createProject(data: { name: string; description?: string }) {
  return apiClient.post<Project>("/projects", data);
}

// 更新项目
export function updateProject(
  id: number,
  data: { name?: string; description?: string; script_text?: string }
) {
  return apiClient.put<Project>(`/projects/${id}`, data);
}

// 删除项目
export function deleteProject(id: number) {
  return apiClient.delete<{ success: boolean }>(`/projects/${id}`);
}

// 导入脚本到项目
export function importScript(id: number, scriptText: string) {
  return apiClient.post<{ project_id: number; script_length: number; success: boolean }>(
    `/projects/${id}/import-script`,
    { script_text: scriptText }
  );
}
