import { apiClient } from "./client";
import type { AuthUser } from "./types";

export type LoginPayload = {
  account: string;
  password: string;
};

export function login(payload: LoginPayload, options?: { suppressToast?: boolean }) {
  return apiClient.post<AuthUser>("/auth/login", payload, options);
}

export function logout(options?: { suppressToast?: boolean }) {
  return apiClient.post<{ success: boolean }>("/auth/logout", undefined, options);
}

export function getCurrentUser(options?: { suppressToast?: boolean }) {
  return apiClient.get<AuthUser>("/auth/me", undefined, options);
}
