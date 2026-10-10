import { randomInt } from "node:crypto";

import { H3 } from "./config.mjs";

export function buildGraph(template, input, firstFrame = "") {
  if (!input.prompt || typeof input.prompt !== "string") throw new Error("Missing prompt");
  if (!Number.isInteger(input.duration) || input.duration < 4 || input.duration > 15)
    throw new Error("Invalid duration");
  const size = H3.resolutions[input.resolution];
  if (!size || input.aspect_ratio !== "9:16") throw new Error("Unsupported video dimensions");
  const graph = structuredClone(template);
  // Fixed graph only. The platform can set inputs, never execute arbitrary nodes.
  const h3 = graph["140:131"].inputs;
  h3.prompt = input.prompt;
  h3.width = size[0];
  h3.height = size[1];
  h3.length = Math.ceil((input.duration * 24 - 5) / 17) * 17 + 5;
  graph["140:129"].inputs.noise_seed = randomInt(2 ** 48 - 1);
  graph["140:126"].inputs.model = ["140:134", 0];
  graph["140:124"].inputs.model = ["140:134", 0];
  graph["140:124"].inputs.steps = H3.steps;
  if (firstFrame) {
    graph.first_frame = { class_type: "LoadImage", inputs: { image: firstFrame } };
    h3.first_frame = ["first_frame", 0];
  }
  // Remove unused UI branches from the official benchmark graph.
  for (const id of [
    "115",
    "140:132",
    "140:133",
    "140:135",
    "140:136",
    "140:137",
    "140:138",
    "140:139",
  ])
    delete graph[id];
  return graph;
}

export function findSubmission(history, queue, submissionId) {
  for (const [id, record] of Object.entries(history)) {
    if (record.prompt?.[3]?.local_submission_id === submissionId) return id;
  }
  for (const record of [...(queue.queue_running || []), ...(queue.queue_pending || [])]) {
    if (record[3]?.local_submission_id === submissionId) return record[1];
  }
  return null;
}

export function videoOutput(record) {
  if (!record.status?.completed || record.status.status_str !== "success") {
    const failure = record.status?.messages?.find(([kind]) => kind === "execution_error");
    if (failure) throw new Error(failure[1].exception_message || "ComfyUI execution failed");
    return null;
  }
  const video = Object.values(record.outputs || {})
    .flatMap((output) => output.images || [])
    .find((file) => file.filename?.endsWith(".mp4"));
  if (
    !video ||
    video.type !== "output" ||
    /[\\/]/.test(video.filename) ||
    video.subfolder?.split(/[\\/]/).includes("..")
  )
    throw new Error("Invalid ComfyUI video output");
  return video;
}
