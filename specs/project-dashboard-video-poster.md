# Project Dashboard Video Poster

## Summary

Use the first decodable frame of the current successful composed project video as the project
thumbnail on the project dashboard.

## User Goal

Creators should be able to recognize a project from its finished video instead of relying only on
an abstract color gradient.

## Workflow

1. Project video composition succeeds.
2. The backend extracts the first decodable frame as a lightweight WebP poster.
3. The project stores the poster URL together with the current composed video.
4. The project dashboard loads the poster as a lazy image and center-crops it to the card frame.
5. Projects without a poster, or whose poster fails to load, keep the existing gradient placeholder.
6. Opening the project dashboard schedules missing posters for existing successful project videos
   in the background, with at most two extraction tasks running at once. The list response never
   waits for video download or ffmpeg.

## Data Shape and API

- `projects.video_poster_url`: poster for the current composed project video.
- Existing project list and detail responses add `video_poster_url`; no new route is introduced.

## Failure and Retry

- Poster extraction is best-effort and never changes a successful video into a failed video.
- Starting a new composition clears the previous poster so it cannot represent the wrong video.
- An idempotent backfill processes only successful project videos without an existing poster.
- The project list automatically runs the same idempotent backfill for legacy projects.
- Concurrent list requests share an in-flight extraction, and failed projects wait ten minutes
  before another automatic retry.
- OSS videos are read directly by ffmpeg through a signed URL instead of being downloaded in full.
- Environments without a WebP encoder fall back to a JPEG poster.

## Acceptance Criteria

- A newly composed project video produces a poster and displays it on the project dashboard.
- Recomposition displays the new video's poster rather than a cached image from an older video.
- Missing, failed, or broken poster images fall back to the existing stable gradient.
- The dashboard does not load project videos to render its cards.
- The historical backfill can be run repeatedly without overwriting existing posters.
