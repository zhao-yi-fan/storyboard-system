import { toast } from "sonner";
import type { ApiResponse } from "./types";
import { clearAuthSession } from "../lib/auth";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getApiBaseUrl() {
  return isBrowser() ? "/api" : BASE_URL;
}

type RequestOptions = RequestInit & {
  suppressToast?: boolean;
};

export type ApiQueryValue = string | number | boolean | null | undefined;
export type ApiQueryParams = Record<string, ApiQueryValue>;
export type ApiRequestBody =
  | Record<string, unknown>
  | readonly unknown[]
  | FormData
  | string
  | number
  | boolean
  | null;

type ToastHandledError = Error & {
  __toastHandled?: boolean;
};

let isRedirectingToLogin = false;

function isUnauthorizedResponse(response: Response, result: ApiResponse<unknown>) {
  return response.status === 401 || result.message === "请先登录";
}

function redirectToLogin() {
  if (!isBrowser() || window.location.pathname === "/login" || isRedirectingToLogin) {
    return;
  }

  isRedirectingToLogin = true;
  clearAuthSession();
  toast.dismiss();
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(`/login?from=${encodeURIComponent(currentPath)}`);
}

async function parseApiResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const rawBody = await response.text();
  if (rawBody.trim()) {
    try {
      return JSON.parse(rawBody) as ApiResponse<T>;
    } catch {
      // Continue below with a stable connection error instead of exposing JSON parser internals.
    }
  }

  const message =
    response.status === 502 || response.status === 503 || response.status === 504
      ? "后端服务不可用，请确认 backend-node 已启动并且 MySQL 连接正常"
      : `接口返回异常响应（HTTP ${response.status}）`;
  throw new Error(message);
}

// 统一请求封装
async function request<T = unknown>(url: string, options: RequestOptions = {}): Promise<T> {
  const { suppressToast = false, ...requestOptions } = options;
  const defaultHeaders: Record<string, string> =
    requestOptions.body instanceof FormData ? {} : { "Content-Type": "application/json" };

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
    const result = await parseApiResponse<T>(response);

    if (isUnauthorizedResponse(response, result)) {
      redirectToLogin();
      const error = new Error(result.message || "请先登录") as ToastHandledError;
      error.__toastHandled = true;
      throw error;
    }

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
function get<T = unknown>(
  url: string,
  params?: ApiQueryParams,
  options?: RequestOptions,
): Promise<T> {
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
function post<T = unknown>(
  url: string,
  data?: ApiRequestBody,
  options?: RequestOptions,
): Promise<T> {
  return request<T>(url, {
    method: "POST",
    body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
    ...options,
  });
}

// PUT 方法封装
function put<T = unknown>(
  url: string,
  data?: ApiRequestBody,
  options?: RequestOptions,
): Promise<T> {
  return request<T>(url, {
    method: "PUT",
    body: data ? JSON.stringify(data) : undefined,
    ...options,
  });
}

// DELETE 方法封装
function del<T = unknown>(url: string, options?: RequestOptions): Promise<T> {
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
