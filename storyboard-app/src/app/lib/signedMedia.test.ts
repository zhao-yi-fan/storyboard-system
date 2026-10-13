import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearSignedMedia,
  currentMediaUrl,
  freshMediaUrl,
  mediaIdentity,
  registerSignedMedia,
  startMediaRenewal,
  subscribeMedia,
} from "./signedMedia";

const signed = (name: string, seconds: number) =>
  `https://bucket.oss-cn-beijing.aliyuncs.com/${name}?Expires=${seconds}&Signature=${seconds}`;

describe("signed media lifecycle", () => {
  beforeEach(() => {
    clearSignedMedia();
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => vi.useRealTimers());
  it("merges renewal of multiple images from the same business request", async () => {
    const a = signed("a.png", 1100);
    const b = signed("b.png", 1100);
    const refresh = vi.fn(async () =>
      registerSignedMedia([signed("a.png", 4600), signed("b.png", 4600)], refresh),
    );
    registerSignedMedia([a, b], refresh);
    const [freshA, freshB] = await Promise.all([freshMediaUrl(a), freshMediaUrl(b)]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(freshA).toBe(signed("a.png", 4600));
    expect(freshB).toBe(signed("b.png", 4600));
    expect(mediaIdentity(a)).toBe(mediaIdentity(freshA));
  });
  it("keeps fresh signatures and non-signed local media unchanged", async () => {
    const url = signed("fresh.png", 4600);
    const refresh = vi.fn();
    registerSignedMedia(url, refresh);
    expect(await freshMediaUrl(url)).toBe(url);
    expect(await freshMediaUrl("blob:preview")).toBe("blob:preview");
    expect(refresh).not.toHaveBeenCalled();
  });
  it("pauses in background and renews mounted media when the page becomes visible", async () => {
    const url = signed("visible.png", 1100);
    const refresh = vi.fn(async () => registerSignedMedia(signed("visible.png", 4600), refresh));
    registerSignedMedia(url, refresh);
    const unsubscribe = subscribeMedia(url, vi.fn());
    const state = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const stop = startMediaRenewal();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(refresh).not.toHaveBeenCalled();
    state.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(currentMediaUrl(url)).toBe(signed("visible.png", 4600));
    stop();
    unsubscribe();
    state.mockRestore();
  });
});
