import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { Worker } from "./worker.mjs";

test("resumes an uploaded file by completing only; never submits or uploads again", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "h3-worker-test-"));
  try {
    const worker = new Worker({ directory });
    worker.state = {
      id: 1,
      token: "token",
      stage: "uploading",
      prompt_id: "prompt-1",
      video: { filename: "out.mp4" },
      downloaded: true,
      uploaded: true,
      object_key: "assigned.mp4",
    };
    await worker.save();
    const calls = [];
    worker.platform = async (route) => {
      calls.push(route);
      return {};
    };
    worker.request = () => {
      throw new Error("Should not call ComfyUI");
    };
    await worker.process();
    assert.deepEqual(calls, ["/jobs/1/heartbeat", "/jobs/1/complete"]);
    assert.equal(worker.state, null);
    await assert.rejects(fs.access(worker.statePath));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("busy ComfyUI prevents claiming another job", async () => {
  const worker = new Worker({ comfy: "http://127.0.0.1:8188", directory: os.tmpdir() });
  worker.request = async () => ({
    json: async () => ({ queue_running: [["busy"]], queue_pending: [] }),
  });
  worker.platform = () => {
    throw new Error("Must not claim");
  };
  await worker.runOnce();
  assert.equal(worker.state, null);
});

test("temporary upload failures retain video state for retry", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "h3-worker-test-"));
  try {
    const worker = new Worker({ directory });
    worker.state = {
      id: 1,
      token: "token",
      stage: "uploading",
      prompt_id: "prompt-1",
      video: { filename: "out.mp4" },
      downloaded: true,
    };
    worker.platform = async (route) => {
      if (route.endsWith("upload-sign")) throw new Error("network interruption");
      return {};
    };
    await assert.rejects(worker.runOnce(), /network interruption/);
    assert.equal(worker.state.prompt_id, "prompt-1");
    assert.equal(worker.state.downloaded, true);
    assert.equal(worker.state.failure, undefined);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
