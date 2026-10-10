# Local H3 worker

Requires Node.js 22+, the installed ComfyUI, and the four H3 model files plus 8-step Turbo LoRA. No npm dependencies are required. The graph is the ComfyUI official H3 benchmark with only supported inputs patched.

1. Deploy the server changes after checks. Set `LOCAL_WORKER_KEY` to a random secret of at least 32 characters and `LOCAL_WORKER_OWNER_ID` to your platform user's ID. Configure OSS and FFmpeg as for existing video generation.
2. Copy `.env.example` to `.env` here. Set the same worker key. Keep ComfyUI on `127.0.0.1:8188` and start it via the tested desktop shortcut.
3. Run `start.cmd`. If Node isn't on PATH, use its absolute path with `--env-file=.env worker.mjs`.
4. Select “MiniMax H3 · 本地电脑” in the platform and submit a scene. Start with preview, 4 seconds. First-frame mode uses the scene cover. Disable first-frame mode to send up to nine reference images and three voice-reference clips (2–15 seconds each, 15 seconds total). Voice references guide timbre; exact dialogue is not guaranteed. Reference mode requires `minimax_h3_ref2va_pruned_int8_convrot.safetensors` and `minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors`, reusing the installed text encoder and VAEs. Original video references are currently rejected; extracted frames work as images.

The worker handles one task at a time. It waits when ComfyUI is busy and keeps job state in `LOCAL_WORKER_DIR/active.json`. Restart with the same state directory to resume. Do not delete that file during generation. Saved MP4s remain in the directory. ComfyUI retains its own output too.

Disconnection does not automatically reassign jobs. The UI offers a manual retry which invalidates the old claim. Upload failures retry without generating again. A submission with an unknown result stops for manual inspection instead of duplicating an expensive generation.

Do not expose port 8188 to the Internet or put worker keys in the React frontend. Server endpoints use dedicated bearer authentication, separate from cookies. A stopped computer leaves jobs queued. One shared worker key/owner is supported in v1; rotate both ends together.

Tests: `node --test scripts/local-worker/*.test.mjs` from repository root. End-to-end cloud acceptance requires server deployment, a valid worker key/owner and OSS credentials; local mock tests do not prove cloud deployment.
