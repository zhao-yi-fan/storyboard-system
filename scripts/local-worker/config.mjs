import path from "node:path";

export const H3 = Object.freeze({
  pollMs: 5000,
  historyMs: 3000,
  heartbeatMs: 15000,
  resolutions: { preview: [352, 608], "480p": [480, 864], "768p": [768, 1344] },
  steps: 8,
  referenceSteps: 4,
  maxImages: 9,
  maxAudios: 3,
  maxMediaBytes: 20 * 1024 * 1024,
});

export function loadConfig(env = process.env) {
  const platform = new URL(env.LOCAL_PLATFORM_URL || "https://popreels.zhaoyifan.top");
  const comfy = new URL(env.COMFYUI_URL || "http://127.0.0.1:8188");
  if (platform.protocol !== "https:" && !["127.0.0.1", "localhost"].includes(platform.hostname)) {
    throw new Error("Platform must use HTTPS");
  }
  if (!["127.0.0.1", "localhost", "[::1]"].includes(comfy.hostname))
    throw new Error("ComfyUI must be on loopback");
  const key = env.LOCAL_WORKER_KEY || "";
  if (key.length < 32) throw new Error("LOCAL_WORKER_KEY must contain at least 32 characters");
  return {
    platform: platform.origin,
    comfy: comfy.origin,
    key,
    directory: path.resolve(env.LOCAL_WORKER_DIR || "D:/AI/local-worker"),
  };
}
