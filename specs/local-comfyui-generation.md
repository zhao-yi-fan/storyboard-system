# Local ComfyUI generation

The existing scene video workflow offers `minimax-h3-local` alongside cloud models. It supports text or one first frame, 4–15 seconds, portrait video, native audio, and preview/480p/768p sizes. Default: preview, 8-step Turbo. Unsupported reference inputs block preview rather than silently disappearing.

The server persists the input snapshot and generation association in MySQL. A dedicated authenticated worker polls every 5 seconds, claims one job atomically, reports heartbeats every 15 seconds, submits a fixed ComfyUI graph, polls history every 3 seconds, uploads MP4 directly to a task-specific OSS object and completes the job. ComfyUI remains on loopback.

States: queued, generating, uploading, succeeded, failed, superseded. A 120-second lease expiry displays disconnected but never reassigns a claimed job. Resume uses the same token. Manual retry supersedes the old job and rejects stale callbacks. Completion is idempotent and transactionally updates scene and generation; old results cannot replace newer results. Requested duration is retained separately from the probed duration.

The worker writes active task/prompt IDs atomically before advancing. It recovers via a persisted submission ID in ComfyUI extra_data if submission response is lost; uncertain submissions are never blindly duplicated. Upload errors retry upload only. Model errors report failure. Completed files remain locally. A single-instance lock prevents two local workers.

Worker authentication is separate from session authentication. Configuration requires a long random worker key and a project owner ID; workers can only claim that owner's jobs. First-frame URLs are signed from server-owned generated media. No arbitrary workflow, download URL or output path is accepted from a remote user. Secrets and local state are ignored by Git.

Acceptance: text 4s, first frame 5s, text 15s; output contains video/audio and appears on its scene. Tests cover concurrent claims, auth, offline queue, interrupted submissions/uploads, duplicate completion, stale retry, references and frontend settings. Deploy only after validation; pushing main deploys automatically.
