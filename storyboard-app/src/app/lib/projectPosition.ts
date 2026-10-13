import { getAuthSession } from "./auth";

const PREFIX = "storyboard_project_position_v1";
const ALLOWED = {
  "/assets": ["project", "view", "chapter", "kind", "entity", "q"],
  "/workspace": ["project", "chapter", "scene"],
} as const;

export function sanitizeProjectPosition(value: string, projectId: number): string | null {
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  const url = new URL(value, "https://position.invalid");
  if (!(url.pathname in ALLOWED) || Number(url.searchParams.get("project")) !== projectId)
    return null;
  const keys = ALLOWED[url.pathname as keyof typeof ALLOWED];
  const params = new URLSearchParams();
  for (const key of keys) {
    const item = url.searchParams.get(key);
    if (item) params.set(key, item);
  }
  return `${url.pathname}?${params}`;
}

function storageKey(projectId: number, workspace = false) {
  const userId = getAuthSession()?.id;
  return userId && projectId > 0
    ? `${PREFIX}:${userId}:${projectId}${workspace ? ":workspace" : ""}`
    : null;
}

export function rememberProjectPosition(projectId: number, path: string) {
  const safePath = sanitizeProjectPosition(path, projectId);
  const key = storageKey(projectId);
  if (!key || !safePath) return;
  try {
    window.localStorage.setItem(key, safePath);
    if (safePath.startsWith("/workspace?"))
      window.localStorage.setItem(`${key}:workspace`, safePath);
  } catch {
    /* Storage is optional; navigation remains usable. */
  }
}

export function getProjectPosition(projectId: number, workspace = false) {
  const fallback = `/workspace?project=${projectId}`;
  const key = storageKey(projectId, workspace);
  if (!key) return fallback;
  try {
    return sanitizeProjectPosition(window.localStorage.getItem(key) ?? "", projectId) ?? fallback;
  } catch {
    return fallback;
  }
}

export function assetPreparationPath(projectId: number, chapterId?: number) {
  return `/assets?project=${projectId}&view=prepare${chapterId ? `&chapter=${chapterId}` : ""}`;
}
