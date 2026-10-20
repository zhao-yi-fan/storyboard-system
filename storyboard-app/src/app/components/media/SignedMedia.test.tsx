import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearSignedMedia, registerSignedMedia } from "../../lib/signedMedia";
import { SignedImage, SignedVideo } from "./SignedMedia";

const signed = (name: string, expires: number) =>
  `https://bucket.oss-cn-beijing.aliyuncs.com/${name}?Expires=${expires}&Signature=${expires}`;

describe("signed media presentation", () => {
  beforeEach(() => {
    clearSignedMedia();
  });
  afterEach(() => vi.restoreAllMocks());
  it("keeps the image element and source unchanged when the same signature is registered again", async () => {
    const url = signed("cached.png", Math.floor(Date.now() / 1000) + 3600);
    registerSignedMedia(url);
    const { container, rerender } = render(<SignedImage alt="cached" src={url} />);
    const image = container.querySelector("img");
    await act(async () => registerSignedMedia(url));
    rerender(<SignedImage alt="cached" src={url} />);
    expect(container.querySelector("img")).toBe(image);
    expect(image).toHaveAttribute("src", url);
  });
  it("keeps the playing video mounted on its source during background renewal", async () => {
    const now = Math.floor(Date.now() / 1000);
    const original = signed("play.mp4", now + 3600);
    const fresh = signed("play.mp4", now + 7200);
    registerSignedMedia(original);
    const { container } = render(<SignedVideo src={original} controls />);
    const video = container.querySelector("video");
    if (!video) throw new Error("video missing");
    video.currentTime = 6;
    fireEvent.play(video);
    await act(async () => registerSignedMedia(fresh));
    expect(container.querySelector("video")).toBe(video);
    expect(video.src).toBe(original);
    expect(video.currentTime).toBe(6);
  });
  it("automatically retries a failed image only once and then shows a persistent retry", async () => {
    const now = Math.floor(Date.now() / 1000);
    const original = signed("retry.png", now + 3600);
    const fresh = signed("retry.png", now + 7200);
    const refresh = vi.fn(async () => registerSignedMedia(fresh, refresh));
    registerSignedMedia(original, refresh);
    render(<SignedImage alt="test" src={original} />);
    await act(async () => fireEvent.error(screen.getByAltText("test")));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByAltText("test")).toHaveAttribute("src", fresh);
    await act(async () => fireEvent.error(screen.getByAltText("test")));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent("媒体加载失败");
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });
  it("restores the video position and resumes playback after signature recovery", async () => {
    const now = Math.floor(Date.now() / 1000);
    const original = signed("recover.mp4", now + 3600);
    const fresh = signed("recover.mp4", now + 7200);
    const refresh = vi.fn(async () => registerSignedMedia(fresh, refresh));
    registerSignedMedia(original, refresh);
    const { container } = render(<SignedVideo src={original} controls />);
    const video = container.querySelector("video");
    if (!video) throw new Error("video missing");
    Object.defineProperty(video, "paused", { configurable: true, get: () => false });
    const play = vi.spyOn(video, "play").mockResolvedValue();
    vi.spyOn(video, "load").mockImplementation(() => { video.currentTime = 0; });
    video.currentTime = 8;
    fireEvent.play(video);
    await act(async () => fireEvent.error(video));
    expect(video.src).toBe(fresh);
    fireEvent.loadedMetadata(video);
    expect(video.currentTime).toBe(8);
    expect(play).toHaveBeenCalledTimes(1);
  });
});
