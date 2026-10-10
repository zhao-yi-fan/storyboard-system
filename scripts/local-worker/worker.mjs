import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

import { H3, loadConfig } from "./config.mjs";
import { buildGraph, findSubmission, videoOutput } from "./graph.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class RejectedTask extends Error {}

export class Worker {
  constructor(config) {
    this.config = config;
    this.statePath = path.join(config.directory, "active.json");
    this.state = null;
  }

  async save() {
    await fs.mkdir(this.config.directory, { recursive: true });
    await fs.writeFile(`${this.statePath}.tmp`, JSON.stringify(this.state));
    await fs.rename(`${this.statePath}.tmp`, this.statePath);
  }

  async request(base, route, options = {}) {
    const response = await fetch(base + route, {
      ...options,
      signal: options.signal || AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${route}`);
    return response;
  }

  async platform(route, body, headers = {}) {
    const response = await fetch(`${this.config.platform}/api/local-worker${route}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${this.config.key}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    if (response.status === 401)
      throw new Error("Worker credentials rejected; check LOCAL_WORKER_KEY");
    if (!response.ok) throw new Error(`Platform HTTP ${response.status}`);
    const result = await response.json();
    if (result.code !== 200) {
      if (
        /Task no longer active|Invalid task credentials|Invalid result|Scene removed|Generation removed|Result superseded/.test(
          result.message || "",
        )
      )
        throw new RejectedTask(result.message);
      throw new Error(result.message || "Platform request failed");
    }
    return result.data;
  }

  async heartbeat() {
    return this.platform(`/jobs/${this.state.id}/heartbeat`, {
      token: this.state.token,
      stage: this.state.stage === "uploading" ? "uploading" : "generating",
      prompt_id: this.state.prompt_id,
    });
  }

  async firstFrame() {
    if (!this.state.input.source_image && !this.state.input.use_first_frame) return "";
    const signed = await this.platform(`/jobs/${this.state.id}/first-frame`, undefined, {
      "X-Task-Token": this.state.token,
    });
    const url = new URL(signed.url);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid first-frame URL");
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`First frame HTTP ${response.status}`);
    const mime = response.headers.get("content-type") || "";
    if (!mime.startsWith("image/")) throw new Error("First frame is not an image");
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 20 * 1024 * 1024) throw new Error("First frame exceeds 20MB");
    const form = new FormData();
    const extension = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
    form.append(
      "image",
      new Blob([buffer], { type: mime }),
      `local-job-${this.state.id}.${extension}`,
    );
    form.append("overwrite", "true");
    const upload = await this.request(this.config.comfy, "/upload/image", {
      method: "POST",
      body: form,
    });
    const image = await upload.json();
    return image.subfolder ? `${image.subfolder}/${image.name}` : image.name;
  }

  async recoverSubmission() {
    const [history, queue] = await Promise.all([
      this.request(this.config.comfy, "/history").then((r) => r.json()),
      this.request(this.config.comfy, "/queue").then((r) => r.json()),
    ]);
    return findSubmission(history, queue, this.state.submission_id);
  }

  async process() {
    if (this.state.failure) {
      await this.platform(`/jobs/${this.state.id}/fail`, {
        token: this.state.token,
        error: this.state.failure,
      });
      await this.clear();
      return;
    }
    await this.heartbeat();
    if (this.state.stage === "submitting" && !this.state.prompt_id) {
      this.state.prompt_id = await this.recoverSubmission();
      if (!this.state.prompt_id) {
        // ComfyUI may have accepted a request whose response was lost. Never resubmit blindly.
        await sleep(10000);
        this.state.prompt_id = await this.recoverSubmission();
      }
      if (!this.state.prompt_id)
        throw new RejectedTask("提交结果未知：请检查 ComfyUI 队列后手动重试，避免重复生成");
      this.state.stage = "generating";
      await this.save();
    }
    if (!this.state.prompt_id) {
      const template = JSON.parse(
        await fs.readFile(new URL("./h3-api.json", import.meta.url), "utf8"),
      );
      const firstFrame = await this.firstFrame();
      const graph = buildGraph(template, this.state.input, firstFrame);
      graph["92"].inputs.filename_prefix = `video/local-job-${this.state.id}`;
      this.state.submission_id = `local-job-${this.state.id}-${this.state.token.slice(0, 16)}`;
      this.state.stage = "submitting";
      await this.save();
      const response = await this.request(this.config.comfy, "/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: graph,
          client_id: this.state.submission_id,
          extra_data: { local_submission_id: this.state.submission_id },
        }),
      });
      const result = await response.json();
      if (!result.prompt_id || Object.keys(result.node_errors || {}).length)
        throw new RejectedTask("ComfyUI rejected workflow");
      this.state.prompt_id = result.prompt_id;
      this.state.stage = "generating";
      await this.save();
      await this.heartbeat();
    }
    if (!this.state.video) {
      let missingHistory = 0;
      for (;;) {
        const response = await this.request(
          this.config.comfy,
          `/history/${encodeURIComponent(this.state.prompt_id)}`,
        );
        const history = await response.json();
        const record = history[this.state.prompt_id];
        if (!record && ++missingHistory >= 10) {
          const queue = await (await this.request(this.config.comfy, "/queue")).json();
          const running = [...(queue.queue_running || []), ...(queue.queue_pending || [])];
          if (!running.some((item) => item[1] === this.state.prompt_id)) {
            throw new RejectedTask("ComfyUI 已丢失该任务记录，请手动重试");
          }
          missingHistory = 0;
        }
        let video;
        try {
          video = record && videoOutput(record);
        } catch (error) {
          throw new RejectedTask(error.message);
        }
        if (video) {
          this.state.video = video;
          await this.save();
          break;
        }
        if (this.taskRejected) throw this.taskRejected;
        await sleep(H3.historyMs);
      }
    }
    const filePath = path.join(this.config.directory, `job-${this.state.id}.mp4`);
    if (!this.state.downloaded) {
      const query = new URLSearchParams(this.state.video);
      const response = await this.request(this.config.comfy, `/view?${query}`);
      await pipeline(Readable.fromWeb(response.body), createWriteStream(`${filePath}.part`));
      await fs.rename(`${filePath}.part`, filePath);
      this.state.downloaded = true;
      this.state.stage = "uploading";
      await this.save();
    }
    if (!this.state.uploaded) {
      const signed = await this.platform(`/jobs/${this.state.id}/upload-sign`, {
        token: this.state.token,
      });
      const stat = await fs.stat(filePath);
      const upload = await fetch(signed.upload_url, {
        method: "PUT",
        body: createReadStream(filePath),
        duplex: "half",
        headers: { "Content-Type": "video/mp4", "Content-Length": String(stat.size) },
        signal: AbortSignal.timeout(15 * 60 * 1000),
      });
      if (!upload.ok) throw new Error(`Video upload HTTP ${upload.status}`);
      this.state.uploaded = true;
      this.state.object_key = signed.object_key;
      await this.save();
    }
    await this.platform(`/jobs/${this.state.id}/complete`, {
      token: this.state.token,
      object_key: this.state.object_key,
    });
    console.log(`Task ${this.state.id} completed: ${filePath}`);
    await this.clear();
  }

  async clear() {
    this.state = null;
    await fs.rm(this.statePath, { force: true });
  }

  async runOnce() {
    if (!this.state) {
      const queue = await (await this.request(this.config.comfy, "/queue")).json();
      if (queue.queue_running?.length || queue.queue_pending?.length) return;
      this.state = await this.platform("/claim", {});
      if (!this.state) return;
      this.state.stage = "generating";
      await this.save();
      console.log(`Claimed task ${this.state.id}`);
    }
    this.taskRejected = null;
    let heartbeating = false;
    const timer = setInterval(() => {
      if (!this.state || heartbeating) return;
      heartbeating = true;
      this.heartbeat()
        .catch((error) => {
          if (error instanceof RejectedTask) this.taskRejected = error;
          console.error(`Heartbeat: ${error.message}`);
        })
        .finally(() => {
          heartbeating = false;
        });
    }, H3.heartbeatMs);
    try {
      await this.process();
    } catch (error) {
      if (error instanceof RejectedTask) {
        if (this.state) {
          this.state.failure = error.message;
          await this.save();
          try {
            await this.platform(`/jobs/${this.state.id}/fail`, {
              token: this.state.token,
              error: error.message,
            });
            await this.clear();
          } catch (reportError) {
            if (reportError instanceof RejectedTask) await this.clear();
            else throw reportError;
          }
        }
      }
      throw error;
    } finally {
      clearInterval(timer);
    }
  }

  async run() {
    await fs.mkdir(this.config.directory, { recursive: true });
    const lockPath = path.join(this.config.directory, "worker.lock");
    try {
      const pid = Number(await fs.readFile(lockPath, "utf8"));
      try {
        process.kill(pid, 0);
        throw new Error("Worker already running");
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
      await fs.rm(lockPath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const lock = await fs.open(lockPath, "wx");
    await lock.writeFile(String(process.pid));
    await lock.close();
    try {
      this.state = JSON.parse(await fs.readFile(this.statePath, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    console.log("Local worker ready; keep ComfyUI running.");
    try {
      for (;;) {
        try {
          await this.runOnce();
        } catch (error) {
          console.error(error.message);
        }
        await sleep(H3.pollMs);
      }
    } finally {
      await fs.rm(lockPath, { force: true });
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await new Worker(loadConfig()).run();
}
