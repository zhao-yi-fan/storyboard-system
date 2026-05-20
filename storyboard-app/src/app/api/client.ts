import { toast } from "sonner";
import type { ApiResponse } from "./types";

export type ApiBackendTarget = "go" | "node";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const API_BACKEND_STORAGE_KEY = "storyboard-api-backend-target";
const API_BACKEND_EVENT = "storyboard-api-backend-change";
const API_BACKEND_PORTS: Record<ApiBackendTarget, number> = {
  go: 8082,
  node: 8083,
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function getApiBackendTarget(): ApiBackendTarget {
  if (!isBrowser()) return "node";
  const stored = window.localStorage.getItem(API_BACKEND_STORAGE_KEY);
  return stored === "go" ? "go" : "node";
}

export function setApiBackendTarget(target: ApiBackendTarget) {
  if (!isBrowser()) return;
  window.localStorage.setItem(API_BACKEND_STORAGE_KEY, target);
  window.dispatchEvent(new CustomEvent<ApiBackendTarget>(API_BACKEND_EVENT, { detail: target }));
}

export function subscribeApiBackendTarget(listener: (target: ApiBackendTarget) => void) {
  if (!isBrowser()) {
    return () => {};
  }

  const handleCustomEvent = (event: Event) => {
    listener((event as CustomEvent<ApiBackendTarget>).detail || getApiBackendTarget());
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === API_BACKEND_STORAGE_KEY) {
      listener(getApiBackendTarget());
    }
  };

  window.addEventListener(API_BACKEND_EVENT, handleCustomEvent);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(API_BACKEND_EVENT, handleCustomEvent);
    window.removeEventListener("storage", handleStorage);
  };
}

export function getApiBaseUrl() {
  if (!isBrowser()) {
    return BASE_URL;
  }

  const target = getApiBackendTarget();
  const protocol = window.location.protocol;
  const hostname = window.location.hostname || "127.0.0.1";
  return `${protocol}//${hostname}:${API_BACKEND_PORTS[target]}/api`;
}

type RequestOptions = RequestInit & {
  suppressToast?: boolean;
};

type ToastHandledError = Error & {
  __toastHandled?: boolean;
};

// 统一请求封装
async function request<T = any>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const { suppressToast = false, ...requestOptions } = options;
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const config: RequestInit = {
    headers: {
      ...defaultHeaders,
      ...requestOptions.headers,
    },
    credentials: "include",
    ...requestOptions,
  };

  try {
    const response = await fetch(`${getApiBaseUrl()}${url}`, config);
    const result: ApiResponse<T> = await response.json();

    // 统一处理响应格式
    if (result.code === 200) {
      // 成功时直接返回 data
      return result.data;
    } else {
      // 失败时统一 toast 提示并抛出错误
      const message = result.message || "请求失败";
      if (!suppressToast) {
        toast.error(message);
      }
      const error = new Error(message) as ToastHandledError;
      error.__toastHandled = !suppressToast;
      throw error;
    }
  } catch (error) {
    // 网络错误等异常也统一处理
    if (error instanceof Error) {
      if ((error as ToastHandledError).__toastHandled || suppressToast) {
        throw error;
      }
      toast.error(error.message);
      throw error;
    }
    if (!suppressToast) {
      toast.error("未知错误");
    }
    throw new Error("未知错误");
  }
}

// GET 方法封装
function get<T = any>(url: string, params?: Record<string, any>, options?: RequestOptions): Promise<T> {
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
    ...options,
  });
}

// POST 方法封装
function post<T = any>(url: string, data?: any, options?: RequestOptions): Promise<T> {
  return request<T>(url, {
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
    ...options,
  });
}

// PUT 方法封装
function put<T = any>(url: string, data?: any, options?: RequestOptions): Promise<T> {
  return request<T>(url, {
    method: "PUT",
    body: data ? JSON.stringify(data) : undefined,
    ...options,
  });
}

// DELETE 方法封装
function del<T = any>(url: string, options?: RequestOptions): Promise<T> {
  return request<T>(url, {
    method: "DELETE",
    ...options,
  });
}

export const apiClient = {
  request,
  get,
  post,
  put,
  delete: del,
};
