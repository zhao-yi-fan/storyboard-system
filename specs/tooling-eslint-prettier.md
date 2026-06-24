# ESLint and Prettier Tooling

## Summary

This pass adds local lint and format tooling for the active frontend in `storyboard-app/` and the active Node backend in `backend-node/`.

- `backend/` remains untouched because it is deprecated and frozen.
- ESLint is configured per subproject because the repository has no root `package.json`.
- Prettier is configured once at the repository root and shared by both subprojects.
- This rollout intentionally stops at local scripts and documentation. It does not add CI, husky, or lint-staged enforcement.

## Coverage

- `storyboard-app/`
  - `src/**/*.{ts,tsx}`
  - `vite.config.ts`
- `backend-node/`
  - `app.ts`
  - `app/**/*.ts`
  - `config/**/*.ts`
  - `scripts/**/*.mjs`
  - `test/**/*.ts`

## Commands

- Frontend
  - `cd storyboard-app && npm run lint`
  - `cd storyboard-app && npm run lint:fix`
  - `cd storyboard-app && npm run format`
  - `cd storyboard-app && npm run format:check`
- Backend
  - `cd backend-node && npm run lint`
  - `cd backend-node && npm run lint:fix`
  - `cd backend-node && npm run format`
  - `cd backend-node && npm run format:check`

## Formatting and Ignore Rules

- Shared Prettier defaults:
  - semicolons enabled
  - two-space indentation
  - trailing commas enabled
  - `printWidth` set to `100`
  - LF line endings
- Quote style is preserved by subproject:
  - `storyboard-app` keeps double quotes
  - `backend-node` keeps single quotes
- Prettier ignores:
  - deprecated backend code
  - `node_modules`
  - build output
  - coverage output
  - runtime `run/` and `logs/` directories
  - lockfiles
  - imported binary assets
