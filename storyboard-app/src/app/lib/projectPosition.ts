import { getAuthSession } from "./auth";

const PREFIX = "storyboard_project_position_v1";
const ALLOWED = {
  "/assets": ["view", "chapter", "kind", "entity", "q"],
  "/workspace": ["project", "chapter", "scene"],
} as const;

export function projectAssetsPath(projectId: number, query?: URLSearchParams): string {
  const params = new URLSearchParams(query);
  params.delete("project");
  return `/projects/${projectId}/assets${params.size ? `?${params}` : ""}`;
}

export function legacyAssetsPath(query: URLSearchParams, prepare = false): string {
  const projectId = Number(query.get("project"));
  if (!Number.isSafeInteger(projectId) || projectId <= 0) return "/projects";
  const params = new URLSearchParams(query);
  if (prepare) params.set("view", "prepare");
  if (params.has("character")) {
    if (!params.has("entity")) params.set("entity", `character:${params.get("character")}`);
    params.delete("character");
  }
  return sanitizeProjectPosition(projectAssetsPath(projectId, params), projectId) ?? "/projects";
}

export function sanitizeProjectPosition(value: string, projectId: number): string | null {
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  const url = new URL(value, "https://position.invalid");
  if (!Number.isSafeInteger(projectId) || projectId <= 0) return null;
  const assetMatch = /^\/projects\/([1-9]\d*)\/assets\/?$/.exec(url.pathname);
  const legacyAsset = url.pathname === "/assets" || url.pathname === "/assets/";
  const asset = Boolean(assetMatch) || legacyAsset;
  if (
    assetMatch
      ? Number(assetMatch[1]) !== projectId
      : Number(url.searchParams.get("project")) !== projectId
  )
    return null;
  if (!asset && url.pathname !== "/workspace") return null;
  const keys = asset ? ALLOWED["/assets"] : ALLOWED["/workspace"];
  const params = new URLSearchParams();
  for (const key of keys) {
    const item = url.searchParams.get(key);
    if (item) params.set(key, item);
  }
  return asset ? projectAssetsPath(projectId, params) : `${url.pathname}?${params}`;
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
  const params = new URLSearchParams({ view: "prepare" });
  if (chapterId) params.set("chapter", String(chapterId));
  return projectAssetsPath(projectId, params);
}
