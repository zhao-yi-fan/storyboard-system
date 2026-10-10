import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { loadConfig } from "./config.mjs";
import { buildGraph, buildReferenceGraph, findSubmission, videoOutput } from "./graph.mjs";

const template = JSON.parse(await fs.readFile(new URL("./h3-api.json", import.meta.url)));
const input = {
  prompt: "A person waves.",
  duration: 4,
  resolution: "preview",
  aspect_ratio: "9:16",
};

test("reference workflow binds ordered image and voice files with native audio", async () => {
  const reference = JSON.parse(await fs.readFile(new URL("./h3-ref2va-api.json", import.meta.url)));
  const params = { ...input, duration: 15, reference_images: [{}, {}], reference_audios: [{}] };
  const graph = buildReferenceGraph(reference, params, ["hero.png", "scene.png"], ["voice.wav"]);
  assert.equal(graph["136"].inputs.length, 362);
  assert.deepEqual(graph["136"].inputs["ref_audios.ref_audio_0"], ["reference_audio_0", 0]);
  assert.equal(graph.reference_audio_0.inputs.audio, "voice.wav");
  assert.equal(graph["124"].inputs.steps, 4);
  assert.deepEqual(graph["130"].inputs.audio, ["121", 0]);
  assert.throws(() => buildReferenceGraph(reference, params, [], []), /Missing reference/);
  assert.throws(
    () => buildReferenceGraph(reference, { ...params, use_first_frame: true }),
    /Unsupported/,
  );
  assert.equal(reference["136"].inputs["ref_images.ref_image_0"], undefined);
});

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
