/** Shared by every worker; no per-process signing state or random query parameters. */
export const BROWSER_MEDIA_POLICY = Object.freeze({
  windowSeconds: 20 * 60,
  lifetimeSeconds: 60 * 60,
  cacheMaxAgeSeconds: 300,
  signingAttempts: 3,
});
