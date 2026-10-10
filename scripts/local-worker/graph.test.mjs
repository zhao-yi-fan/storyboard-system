import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { loadConfig } from "./config.mjs";
import { buildGraph, findSubmission, videoOutput } from "./graph.mjs";

const template = JSON.parse(await fs.readFile(new URL("./h3-api.json", import.meta.url)));
const input = {
  prompt: "A person waves.",
  duration: 4,
  resolution: "preview",
  aspect_ratio: "9:16",
};

test("supports native audio text and first-frame workflows within duration limits", () => {
  const graph = buildGraph(template, input);
  assert.equal(graph["140:131"].inputs.width, 352);
  assert.equal(graph["140:131"].inputs.height, 608);
  assert.equal(graph["140:131"].inputs.length, 107);
  assert.equal(graph["140:124"].inputs.steps, 8);
  assert.deepEqual(graph["140:130"].inputs.audio, ["140:121", 0]);
  const firstFrame = buildGraph(template, { ...input, duration: 15 }, "frame.png");
  assert.deepEqual(firstFrame["140:131"].inputs.first_frame, ["first_frame", 0]);
  assert.equal(firstFrame.first_frame.inputs.image, "frame.png");
  assert.equal(firstFrame["140:131"].inputs.length, 362);
  assert.throws(() => buildGraph(template, { ...input, duration: 30 }), /duration/);
  assert.throws(() => buildGraph(template, { ...input, resolution: "1080p" }), /dimensions/);
});

test("recovers an accepted prompt without submitting it twice", () => {
  const extra = { local_submission_id: "submission-1" };
  assert.equal(
    findSubmission({ "prompt-1": { prompt: [0, "prompt-1", {}, extra] } }, {}, "submission-1"),
    "prompt-1",
  );
  assert.equal(
    findSubmission({}, { queue_running: [[0, "prompt-2", {}, extra]] }, "submission-1"),
    "prompt-2",
  );
  assert.equal(findSubmission({}, {}, "missing"), null);
});

test("extracts output and exposes model failures instead of polling forever", () => {
  const file = { filename: "test.mp4", subfolder: "video", type: "output" };
  assert.equal(
    videoOutput({
      status: { completed: true, status_str: "success" },
      outputs: { save: { images: [file] } },
    }),
    file,
  );
  assert.throws(
    () =>
      videoOutput({
        status: { messages: [["execution_error", { exception_message: "out of memory" }]] },
      }),
    /out of memory/,
  );
  assert.throws(
    () =>
      videoOutput({
        status: { completed: true, status_str: "success" },
        outputs: { save: { images: [{ ...file, filename: "../bad.mp4" }] } },
      }),
    /Invalid/,
  );
});

test("rejects public ComfyUI addresses and short credentials", () => {
  assert.throws(() => loadConfig({ LOCAL_WORKER_KEY: "x" }), /32/);
  assert.throws(
    () => loadConfig({ LOCAL_WORKER_KEY: "x".repeat(32), COMFYUI_URL: "https://example.com" }),
    /loopback/,
  );
  assert.equal(loadConfig({ LOCAL_WORKER_KEY: "x".repeat(32) }).comfy, "http://127.0.0.1:8188");
});
