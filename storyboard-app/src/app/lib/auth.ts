import type { AuthUser } from "../api";

export type AuthSession = AuthUser;

const AUTH_SESSION_KEY = "storyboard_auth_user";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getAuthSession(): AuthSession | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    const account = String(parsed.account ?? "").trim();
    const displayName = String(parsed.display_name ?? "").trim();
    const roleLabel = String(parsed.role_label ?? "").trim();
    if (!account || !displayName || !roleLabel) return null;
    return {
      id: Number(parsed.id ?? 0),
      account,
      display_name: displayName,
      role_label: roleLabel,
      is_active: Boolean(parsed.is_active ?? true),
      last_login_at: parsed.last_login_at ?? null,
      created_at: parsed.created_at ?? null,
      updated_at: parsed.updated_at ?? null,
    };
  } catch {
    return null;
  }
}

export function saveAuthSession(session: AuthSession) {
  if (!isBrowser()) return;
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function clearAuthSession() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(AUTH_SESSION_KEY);
}

/**
 * 登录回跳目标只走 query `?from=`（location.state 刷新即丢）。
 * 仅接受本站单 `/` 开头路径，其余一律回 fallback。
 */
export function getRedirectTarget(search: string, fallback = "/projects"): string {
  const target = new URLSearchParams(search).get("from") ?? "";
  return target.startsWith("/") && !target.startsWith("//") ? target : fallback;
}

/** 拼登录地址，有回跳目标就带上 `?from=`。 */
export function buildLoginUrl(from?: string): string {
  if (!from) return "/login";
  return `/login?from=${encodeURIComponent(from)}`;
}
