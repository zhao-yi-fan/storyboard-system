// 统一后端响应格式
export type ApiResponse<T = any> = {
  code: number;
  data: T;
  message: string;
};

// 项目实体类型
export type Project = {
  id: number;
  name: string;
  description: string;
  scriptText: string;
  created_at?: string;
  updated_at?: string;
};

// 章节实体类型
export type Chapter = {
  id: number;
  project_id: number;
  title: string;
  summary: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

// 场景实体类型
export type Scene = {
  id: number;
  chapter_id: number;
  project_id: number;
  title: string;
  description: string;
  location: string;
  time_of_day: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

// 角色实体类型
export type Character = {
  id: number;
  project_id: number;
  name: string;
  description: string;
  avatar_url: string;
  created_at?: string;
  updated_at?: string;
};

// 资产实体类型
export type Asset = {
  id: number;
  project_id: number;
  character_id?: number;
  url: string;
  type: string;
  name: string;
  created_at?: string;
  updated_at?: string;
};

// 分镜镜头实体类型
export type Storyboard = {
  id: number;
  scene_id: number;
  chapter_id: number;
  project_id: number;
  shot_number: number;
  content: string;
  camera_direction: string;
  duration: number;
  background: string;
  thumbnail_url: string;
  notes: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};
