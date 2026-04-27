# AGENTS.md

## Project Overview

This repository is an AI storyboard and comic-drama generation system.

The main workflow is:

1. Input novel text.
2. Parse it into structured shots.
3. Edit shots, characters, scenes, dialogue, and prompts.
4. Generate shot cover images.
5. Generate shot videos from images and assets.
6. Compose final videos with ffmpeg.

The project is interest-driven, but treat it as a real product workflow tool. Prefer clear user flows, recoverable task states, and explicit data structures over one-off demos.

## Repository Layout

- `storyboard-app/`: React + Vite frontend generated initially from Figma Make, then organized into maintainable app code.
- `backend/`: Go + Gin backend with MySQL persistence and external AI/OSS/video generation integrations.
- `docs/`: Project notes and specifications when present.
- `scripts/`: Deployment and utility scripts.
- `DEPLOY.md`: Deployment notes for ECS.

## Development Principles

- Preserve the existing structure and naming style unless a change is required.
- Keep generated or AI-assisted UI code maintainable: extract reusable components, remove dead code, and avoid large unstructured files.
- Prefer explicit types and status values for long-running AI generation work.
- Keep AI workflows user-controllable: loading, success, failed, retry, preview, and edit states should be visible where relevant.
- Do not hide failures behind only transient toasts; persistent task-level errors are usually more useful.
- Do not commit secrets, API keys, access tokens, or real credential values.

## Frontend Guidance

- Frontend code lives in `storyboard-app/`.
- Use React with TypeScript-style structure where the project already does so.
- Keep API calls and data-shaping logic separate from presentational components when practical.
- For image and video heavy screens, prefer thumbnails, lazy loading, stable layout dimensions, and localized updates.
- Avoid loading full-size generated assets in list views unless the user explicitly opens a preview.
- Preserve Figma-originated visual intent when useful, but prioritize readable component structure and predictable state handling.

Useful commands:

```bash
cd storyboard-app
npm run dev
npm run build
```

## Backend Guidance

- Backend code lives in `backend/`.
- Use Go conventions and run `gofmt` after editing Go files.
- Keep database access in repository packages, request handling in handlers, and external integration logic in services.
- Treat image/video/model calls as long-running or failure-prone operations.
- Prefer explicit task statuses and saved error details for generation flows.

Useful commands:

```bash
cd backend
go build ./...
```

## Specification-Driven Work

When adding a feature, first look for a related spec in `docs/` or `specs/`. If no spec exists and the feature is non-trivial, create or update a concise Markdown spec before implementation.

A good spec should define:

- User goal.
- Workflow steps.
- Data shape.
- UI states.
- Failure and retry behavior.
- Acceptance criteria.

SDD documents are normal Markdown files. Cursor rules or Codex instructions should reference these specs rather than duplicating full product requirements.

## Validation

Run the smallest relevant validation before finishing:

- Frontend changes: `npm run build` from `storyboard-app/`.
- Backend changes: `go build ./...` from `backend/`.
- Go formatting: `gofmt -w` on changed Go files.

If validation cannot be run, explain why in the final response.
