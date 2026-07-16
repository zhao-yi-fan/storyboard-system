# Figma Make Version 49 UI Refresh

## Summary

Align the authenticated project dashboard and storyboard workspace with Figma Make Version 49 while preserving the current API contracts, persistence model, generation states, and recovery flows.

## User Goal

The creator should move from project selection into a focused production workspace with less visual noise, a clearer left-to-right hierarchy, and a larger prompt editing surface without losing existing production capabilities.

## Scope

Included:

- A global left navigation and project-card dashboard.
- A full-bleed workspace canvas with floating navigation and generation cards around the video stage.
- A plain-text-backed rich prompt editor with atomic `@` mentions for project characters and scene assets.
- A fullscreen prompt editor synchronized with the inline editor.
- Existing cover, video, composition, asset, version, save, delete, and retry operations remain available.
- Placeholder controls without a working data flow are removed instead of being presented as available features.

Not included:

- Database fields, authentication, or changes to the frozen Go backend.
- Models or generation parameters unsupported by the active Node backend.
- Persisting editor HTML or a separate mention schema.

## Current Problem

The project dashboard uses a top navigation and a dense generic card grid. The workspace mixes chapter navigation, shot cards, editing forms, media history, and production actions in a single oversized component. Prompt editing is a plain textarea and cannot represent asset references as atomic visual units.

## Workflow

1. The user signs in and lands on `/projects`.
2. The user searches, creates, renames, pins, deletes, or opens a project from the dashboard. The project-level asset library remains available here.
3. Opening a project loads `/workspace?project=<id>`.
4. The user chooses a chapter, scene, and shot from the left production navigation; only the episode rail uses a glass card, while scene and shot content sits directly on the canvas.
5. The user can click the plus button on a divider above, between, or below scenes to open the existing scene creation dialog and insert at that position.
6. The center stage shows the current video and its persisted generation history.
7. The floating right inspector manages references, prompt text, shot parameters, cover generation, video generation, and secondary actions without navigating away to the asset library.
8. Typing `@` opens project characters and scene assets. Selecting an item inserts an atomic chip and binds the existing reference when needed.
9. Saving persists readable plain text such as `@李明` through the existing storyboard update API.
10. Script import accepts pasted text only until a real file parsing flow exists; import options shown in the UI must be sent to and honored by the backend.
11. A generated scene cover is shown as the corresponding segment thumbnail in the workspace navigator.

## Data Shape

No new persisted shape is introduced.

- `Storyboard.content` remains plain text.
- `Storyboard.characters` remains the source of truth for character image references.
- `Storyboard.assets` remains the source of truth for scene/background image references.
- Mention DOM nodes carry transient `data-mention-kind`, `data-mention-id`, and `data-mention-name` attributes only while editing.

## UI States

- Dashboard: loading, populated card grid, search empty state, initial empty state, delete pending, pin pending, and rename pending.
- Workspace navigation: loading, no project, no scene, no shot, selected shot.
- Video stage: no video, generating, failed with persistent error, succeeded, and historical/current version states.
- Inspector: no shot, reference loading, prompt editing, fullscreen editing, saving, cover generation, and video generation.
- Narrow desktop: chapter rail remains visible; navigator and inspector can collapse or use constrained widths without making actions unreachable.

## Visual Theme

- Workspace uses a coordinated graphite blue-gray canvas instead of a white background against pure black cards.
- Navigation and generation panels use translucent glass surfaces, low-contrast edges, inner highlights, and one shared shadow system.
- The center stage uses a subtle teal-gray ambient glow; media keeps a dark matte only where needed for image and video contrast.
- Teal is the primary workspace identity color. Warm gold is limited to ambient background light, avoiding competing saturated accents.

## API Changes

- Video preview and generation accept optional `resolution` and `generate_audio` parameters.
- Scene creation accepts an optional `sort_order`; later scenes shift down when inserting between existing scenes.
- Mention selection reuses `POST /storyboards/:id/characters` or `POST /storyboards/:id/assets`.
- Save continues to use `PUT /storyboards/:id`.
- Mention deletion does not call reference removal APIs.

## Persistence / Async Tasks

- No database changes.
- Existing media generation records remain authoritative for loading, failed, succeeded, retry, current version, and history states.
- Editor HTML is never persisted.
- Cover and video generation save a dirty shot draft before requesting the generation preview.

## Failure and Retry

- A failed mention binding leaves the inserted prompt text visible and reports a persistent toast; the reference panel remains authoritative.
- Existing media failures remain visible in the stage/inspector and continue using current retry and history behavior.
- Ambiguous duplicate names are rendered as plain text unless an existing bound reference uniquely identifies the mention.

## Acceptance Criteria

- `/projects` matches the Version 49 left-navigation and card hierarchy while retaining all current project operations.
- `/workspace` uses a full-bleed stage with a detached episode rail, background-free scene/shot navigation, and a floating right generation card while retaining every existing production operation.
- The workspace uses a deep graphite blue-gray canvas; the episode navigator and right generation panel share translucent glass styling.
- The workspace header uses the same translucent material family as the panels; primary text and icons use soft white tones with restrained teal accents.
- Scene dividers expose a plus button above, between, and below scenes; clicking it opens the scene dialog and preserves the selected insertion position.
- The workspace header has no account menu; logout remains available from the outer project dashboard.
- The dashboard has one fixed card-grid presentation and no derived status filter.
- The dashboard does not show a fabricated completion percentage.
- The dashboard account menu opens inward from the sidebar and remains inside the viewport.
- The account menu only exposes working actions.
- Script import does not show file upload, parsing controls, or simulated progress/statistics unless they are backed by a real API contract.
- Asset library actions never claim to bind an asset unless a storyboard binding request succeeds.
- Scene cover generation remains available and its result is visible in the segment navigator.
- Character and reference management has one inspector entry point in addition to direct `@` mention selection.
- Only backend-supported model and parameter values are shown.
- Seedance 2.0 supports `480p`, `720p`, `1080p`, durations from 4 through 15 seconds, and an audio toggle; the default is `720p / 5 seconds / audio`.
- Workspace reference remediation opens the existing character or scene-asset manager instead of navigating to `/assets`.
- `@` opens grouped character/scene choices with thumbnails and bound state.
- Mention chips are atomic for cursor movement and deletion, and save as plain text.
- Inline and fullscreen prompt editors stay synchronized.
- Removing the final mention chip for a bound character or asset also removes that reference binding; duplicate mentions keep the binding until the last chip is removed.
- No files under the frozen `backend/` are changed.

## Validation

- Spec guard: `npm run check:spec:working`
- Frontend: `cd storyboard-app && npm run build`
- Manual:
  - Verify dashboard search, create, open, pin, rename, delete, and sidebar account-menu placement.
  - Verify chapter, scene, shot, generation, history, save, composition, and delete flows.
  - Verify mention insertion, duplicate prevention, atomic deletion, fullscreen synchronization, save, and reload.
