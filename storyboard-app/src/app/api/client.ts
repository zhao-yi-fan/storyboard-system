import { toast } from "sonner";
import type { ApiResponse } from "./types";

// 配置 API 基础 URL
// 生产环境由 nginx 反向代理 /api 到 localhost:8082，所以使用相对路径
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

// 统一请求封装
async function request<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const config: RequestInit = {
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: "include",
    ...options,
  };

  try {
    const response = await fetch(`${BASE_URL}${url}`, config);
    const result: ApiResponse<T> = await response.json();

    // 统一处理响应格式
    if (result.code === 200) {
      // 成功时直接返回 data
      return result.data;
    } else {
      // 失败时统一 toast 提示并抛出错误
      const message = result.message || "请求失败";
      toast.error(message);
      throw new Error(message);
    }
  } catch (error) {
    // 网络错误等异常也统一处理
    if (error instanceof Error) {
      toast.error(error.message);
      throw error;
    }
    toast.error("未知错误");
    throw new Error("未知错误");
  }
}

// GET 方法封装
function get<T = any>(url: string, params?: Record<string, any>): Promise<T> {
  let queryString = "";
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    queryString = `?${searchParams.toString()}`;
  }
  return request<T>(`${url}${queryString}`, {
    method: "GET",
  });
}

// POST 方法封装
function post<T = any>(url: string, data?: any): Promise<T> {
  return request<T>(url, {
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });
}

// PUT 方法封装
function put<T = any>(url: string, data?: any): Promise<T> {
  return request<T>(url, {
    method: "PUT",
    body: data ? JSON.stringify(data) : undefined,
  });
}

// DELETE 方法封装
function del<T = any>(url: string): Promise<T> {
  return request<T>(url, {
    method: "DELETE",
  });
}

export const apiClient = {
  request,
  get,
  post,
  put,
  delete: del,
};
