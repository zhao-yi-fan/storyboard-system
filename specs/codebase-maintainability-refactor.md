# Codebase Maintainability Refactor

## User goal

Reduce frontend and Node backend maintenance risk without changing existing API behavior,
business rules, persisted data, or user-visible workflows.

## Scope

### Frontend

- Keep page components focused on routing, page-level selection, and workflow orchestration.
- Move substantial dialogs and coherent page regions into feature-local components.
- Move long-running video polling into a lifecycle-safe hook with explicit states.
- Route file uploads through the shared API client.
- Replace generic request payload `any` types with explicit reusable request value types.

### Node backend

- Centralize controller id parsing and controller error-to-response handling.
- Preserve the response contract:
  - success: `{ code: 200, data, message: "" }`
  - failure: `{ code: 0, data: null, message }`
- Split large services by repository, assembly, and generation/media responsibilities while
  preserving the existing Egg service entry points.
- Restore TypeScript checking incrementally in extracted modules.

## Invariants

- Existing routes, methods, request bodies, response bodies, and authentication behavior do not
  change.
- Existing database statements and transaction boundaries do not change unless a regression test
  proves equivalent behavior.
- Existing AI prompts, provider arguments, task persistence, retry behavior, and media processing
  do not change.
- Dialog labels, actions, disabled states, previews, and confirmation behavior remain equivalent.
- Existing uncommitted work is preserved.

## UI states

Long-running frontend operations retain visible states for loading, generation, failure, retry,
preview, and completion. Extracted components receive explicit state and callbacks rather than
calling unrelated APIs implicitly.

## Failure and retry behavior

- API errors continue to use the unified persistent/page state where present and toast behavior
  where already established.
- Polling stops on terminal success, terminal failure, unmount, or target change.
- Upload failures use the same unauthorized and malformed-response handling as other API calls.

## Acceptance criteria

- `Workspace.tsx` and `AssetLibrary.tsx` no longer contain substantial dialog implementations
  inline.
- Coherent large page regions and polling behavior are extracted into feature-local modules.
- OSS upload no longer bypasses the shared API client.
- Controller boilerplate is centralized without route or response changes.
- Large services delegate at least their distinct repository/assembly/generation responsibilities
  to focused modules without changing their public Egg service methods.
- New or extracted modules avoid `@ts-nocheck` where practical and expose explicit types.
- Frontend build and lint pass.
- Node backend build, lint, and full test suite pass.
- Regression tests cover shared request error handling, controller wrappers, polling lifecycle
  helpers, and preserved service delegation boundaries where unit-level coverage is practical.
