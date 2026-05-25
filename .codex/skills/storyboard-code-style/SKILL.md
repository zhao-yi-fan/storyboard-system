---
name: storyboard-code-style
description: Enforce maintainable UI and component code structure for the storyboard-system project. Use when the user asks for code style rules, component extraction, deduplication, JSX/DOM cleanup, frontend maintainability review, or refactors that turn repeated UI into data-driven structures.
---

# Storyboard Code Style

Use this skill for maintainability work, especially in `storyboard-app/`.

## Core rules

1. Repetition threshold
- If the same or nearly the same structure appears 2 or more times, consider extracting it.
- Extraction targets can be:
  - local render helper
  - constant config array
  - reusable component
  - shared utility
- Do not keep repeated sibling JSX blocks when a small data structure plus `.map()` would make the shape obvious.

2. Long JSX / DOM threshold
- If one JSX block is longer than about 50 lines and represents a coherent sub-area, extract it into a component.
- Common extraction targets:
  - panel section
  - list item card
  - dialog body
  - toolbar group
  - preview block
- Keep parent files focused on page state, orchestration, and data flow.

3. Similar DOM should not be flat
- If multiple UI blocks differ only by label, icon, state, or minor text, do not hand-write them one by one.
- Prefer a typed config array and render with `.map()`.
- Prefer one source of truth for repeated badges, field rows, action buttons, and preview cards.

4. Data-driven rendering first
- Prefer:
  - `items.map(...)`
  - section config arrays
  - option config arrays
  - small render helpers
- Avoid copy-pasting DOM for tabs, badges, metadata rows, prompt sections, and repeated dialog content.

5. Extraction should stay local before becoming global
- First ask whether the duplication is only within one file.
- If yes, prefer:
  - a small local component in the same file, or
  - a nearby extracted component under the same feature folder.
- Only move code into shared `components/` when reuse is real across features.

6. Keep abstractions shallow
- Do not build generic wrapper components when the project only has one real use.
- Extract enough to remove duplication and clarify structure, but do not introduce vague "universal" components with bloated props.

7. Review standard for maintainability
- When reviewing UI code, actively look for:
  - repeated JSX blocks
  - repeated literal option arrays written inline in multiple places
  - repeated badges / rows / cards with only text changes
  - giant page files that mix state, API calls, dialogs, cards, and detail sections without boundaries
- Call these out explicitly and propose the smallest useful extraction.

## Preferred refactor patterns

### Pattern A: repeated option DOM -> config + map
Use when multiple `SelectItem`, buttons, badges, or metadata rows share the same structure.

### Pattern B: long panel section -> local component
Use when one subsection of a page is visually and logically independent.

### Pattern C: repeated dialog sections -> section component
Use when dialogs contain multiple blocks with identical shells and different content.

### Pattern D: repeated preview/media cards -> item component
Use when list cards share the same frame, actions, and status treatment.

## Practical thresholds

Use these as defaults, not rigid laws:
- 2 similar blocks: strongly consider extraction
- 3+ similar blocks: extraction is expected
- 50+ lines of JSX for one sub-area: extract
- 150+ lines in one React component with multiple distinct UI regions: split unless there is a strong reason not to

## What to avoid

- Large flat JSX with many repeated sibling blocks
- Repeating the same label-row structure manually
- Inline anonymous render logic copied into multiple sections
- Shared components that hide simple markup but create harder-to-read prop contracts
- Premature global abstraction when reuse is only local

## How to apply in storyboard-system

When changing `storyboard-app/`:
- Prefer feature-local extraction first.
- Keep API logic separate from presentational repetition when practical.
- For pages like `Workspace.tsx` and `AssetLibrary.tsx`, continuously push repeated UI into:
  - local config arrays
  - focused subcomponents
  - reusable render blocks

When asked for a cleanup or refactor:
1. Find repeated or oversized UI regions.
2. Group by true repetition, not by superficial similarity.
3. Extract the smallest component or config structure that makes the page easier to scan.
4. Re-run frontend build.

## Output expectations

When using this skill, prefer responses and edits that:
- name the duplication clearly
- explain why extraction improves maintainability
- keep the refactor scoped
- avoid speculative abstraction
