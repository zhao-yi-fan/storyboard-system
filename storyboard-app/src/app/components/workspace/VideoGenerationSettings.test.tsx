import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VIDEO_MODEL, VIDEO_RESOLUTION } from "../../constants/domain";
import { VideoGenerationSettings } from "./VideoGenerationSettings";

describe("local H3 settings", () => {
  beforeEach(() =>
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    ),
  );
  afterEach(() => vi.unstubAllGlobals());
  it("offers preview and native sizes, 4–15 seconds, and fixed audio", async () => {
    const onResolutionChange = vi.fn();
    render(
      <VideoGenerationSettings
        model={VIDEO_MODEL.MINIMAX_H3_LOCAL}
        aspectRatio="9:16"
        resolution={VIDEO_RESOLUTION.LOCAL_PREVIEW}
        duration={5}
        generateAudio={true}
        onResolutionChange={onResolutionChange}
        onDurationChange={vi.fn()}
        onGenerateAudioChange={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByText("9:16 / preview / 5秒 / 有声"));
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuemin", "4");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuemax", "15");
    expect(screen.getByRole("switch")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "768p" }));
    expect(onResolutionChange).toHaveBeenCalledWith("768p");
    expect(screen.queryByRole("button", { name: "1080p" })).not.toBeInTheDocument();
  });
});
