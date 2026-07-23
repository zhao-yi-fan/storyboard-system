# Workspace Video Poster

## Summary

Use the first decodable frame of the current successful segment video as the segment thumbnail in the Workspace navigator.

## User Goal

Creators should be able to identify a segment from its generated video even when they did not generate a separate segment cover.

## Scope

Included:

- Persist one lightweight poster image for each successful segment video version.
- Cache the current video version poster on the segment.
- Prefer the current video poster in the Workspace segment navigator.
- Backfill posters for existing current video versions.

Not included:

- Using the poster as the Seedance first-frame input.
- Adding the poster to generation references or prompt text.
- Replacing or deleting an existing generated segment cover.

## Workflow

1. A segment video generation, composition, or clip succeeds.
2. The backend extracts the first decodable frame as a WebP poster.
3. The media version stores its poster URL.
4. When that version is current, the segment stores the same URL as its current video poster.
5. The Workspace displays the video poster, then falls back to the segment cover, then to a fixed placeholder.
6. Switching or deleting the current video version updates the cached segment poster.

## Data Shape

- `scenes.video_poster_url`: poster for the current video version.
- `scene_media_generations.poster_url`: poster belonging to one video version.

## UI States

- Current video poster available.
- Segment cover fallback available.
- No media image available: stable placeholder remains visible.

## API Changes

Existing scene and scene media generation responses add `video_poster_url` and `poster_url`. No new route is introduced.

## Persistence / Async Tasks

- Posters are lightweight WebP objects stored with generated media.
- Poster extraction failure does not change a successful video into a failed video.
- An idempotent sequential backfill fills current historical video posters without overwriting existing values.

## Failure and Retry

- New video poster extraction failures are logged and leave the segment cover fallback intact.
- A historical video without a poster is retried when it is set as current or when the backfill script runs.

## Acceptance Criteria

- A segment with a current successful video displays its video poster in the left navigator.
- Video posters take precedence over generated segment covers without changing generation inputs.
- Switching and deleting current video versions keeps the displayed poster synchronized.
- Segments without a poster or cover display a fixed placeholder with stable dimensions.
- Historical current videos can be backfilled safely more than once.

## Validation

- Spec guard: `npm run check:spec:working`
- Backend: `cd backend-node && npm run build && npm run test`
- Frontend: `cd storyboard-app && npm run build`
