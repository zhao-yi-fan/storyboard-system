const RENEW_BEFORE_MS = 5 * 60 * 1000;

type Entry = { url: string; refresh?: () => Promise<unknown> };
const entries = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
const pending = new Map<() => Promise<unknown>, Promise<unknown>>();

export function clearSignedMedia(): void {
  entries.clear();
  pending.clear();
  listeners.forEach((set) => set.forEach((notify) => notify()));
}

export function mediaIdentity(value: string): string {
  try {
    const url = new URL(value);
    if (url.searchParams.has("Expires") && url.searchParams.has("Signature")) {
      return `${url.origin}${url.pathname}`;
    }
  } catch {
    /* local or Blob media has no signature */
  }
  return value;
}

export function mediaExpiresAt(value: string): number | null {
  try {
    const url = new URL(value);
    if (!url.searchParams.has("Signature")) return null;
    const seconds = Number(url.searchParams.get("Expires"));
    return seconds > 0 && Number.isFinite(seconds) ? seconds * 1000 : null;
  } catch {
    return null;
  }
}

export function currentMediaUrl(value: string): string {
  return entries.get(mediaIdentity(value))?.url ?? value;
}

/** Keep business IDs/data untouched; publish fresh signatures to mounted media. */
export function registerSignedMedia(data: unknown, refresh?: () => Promise<unknown>): void {
  if (typeof data === "string") {
    if (mediaExpiresAt(data) === null) return;
    const identity = mediaIdentity(data);
    const previous = entries.get(identity);
    const newer = (mediaExpiresAt(data) ?? 0) >= (mediaExpiresAt(previous?.url ?? "") ?? 0);
    entries.set(identity, {
      url: newer ? data : (previous?.url ?? data),
      refresh: refresh ?? previous?.refresh,
    });
    if (newer && previous?.url !== data) listeners.get(identity)?.forEach((notify) => notify());
    return;
  }
  if (Array.isArray(data)) data.forEach((item) => registerSignedMedia(item, refresh));
  else if (data && typeof data === "object") {
    Object.values(data).forEach((item) => registerSignedMedia(item, refresh));
  }
}

export function subscribeMedia(value: string, notify: () => void): () => void {
  const identity = mediaIdentity(value);
  const set = listeners.get(identity) ?? new Set();
  set.add(notify);
  listeners.set(identity, set);
  return () => {
    set.delete(notify);
    if (!set.size) listeners.delete(identity);
  };
}

export async function freshMediaUrl(value: string, force = false): Promise<string> {
  const identity = mediaIdentity(value);
  const entry = entries.get(identity);
  const current = entry?.url ?? value;
  const expires = mediaExpiresAt(current);
  if (!entry?.refresh || (!force && (expires === null || expires > Date.now() + RENEW_BEFORE_MS)))
    return current;
  let request = pending.get(entry.refresh);
  if (!request) {
    const refresh = entry.refresh;
    request = Promise.resolve()
      .then(refresh)
      .finally(() => pending.delete(refresh));
    pending.set(refresh, request);
  }
  await request;
  return currentMediaUrl(value);
}

/** Only active, visible media renew; no per-image API calls. */
export function startMediaRenewal(): () => void {
  const renew = () => {
    if (document.visibilityState !== "visible") return;
    for (const identity of listeners.keys()) void freshMediaUrl(identity).catch(() => undefined);
  };
  const timer = window.setInterval(renew, 30_000);
  document.addEventListener("visibilitychange", renew);
  window.addEventListener("focus", renew);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", renew);
    window.removeEventListener("focus", renew);
  };
}

export async function fetchMedia(value: string, options?: RequestInit): Promise<Response> {
  const response = await fetch(await freshMediaUrl(value), options);
  if (response.status !== 403) return response;
  await response.body?.cancel();
  return fetch(await freshMediaUrl(value, true), options);
}
