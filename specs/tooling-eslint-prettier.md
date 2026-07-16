# ESLint and Prettier Tooling

## Summary

This pass adds repository-wide lint and format tooling for root scripts, the active frontend in `storyboard-app/`, and the active Node backend in `backend-node/`.

- `backend/` remains untouched because it is deprecated and frozen.
- ESLint keeps framework-specific rules in each subproject and uses the root config for repository scripts.
- Prettier is configured once at the repository root and shared by both subprojects.
- Warnings fail lint commands so `npm run lint` can be used as a quality gate.
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
- repository root
  - `scripts/**/*.mjs`
  - supported source, config, JSON, CSS, and Markdown files through Prettier

## Commands

- Whole repository
  - `npm run lint`
  - `npm run lint:fix`
  - `npm run format`
  - `npm run format:check`

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
