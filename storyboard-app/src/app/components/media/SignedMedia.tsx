import type { ComponentProps, SyntheticEvent } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  currentMediaUrl,
  freshMediaUrl,
  mediaIdentity,
  subscribeMedia,
} from "../../lib/signedMedia";
import { Button } from "../ui/button";

function useSignedSource(src = "") {
  const identity = mediaIdentity(src);
  const latest = useSyncExternalStore(
    (notify) => subscribeMedia(src, notify),
    () => currentMediaUrl(src),
  );
  const retry = useRef(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    retry.current = false;
    setFailed(false);
    void freshMediaUrl(src).catch(() => setFailed(true));
  }, [identity, src]);
  const recover = async () => {
    if (retry.current) {
      setFailed(true);
      return "";
    }
    retry.current = true;
    try {
      return await freshMediaUrl(src, true);
    } catch {
      setFailed(true);
      return "";
    }
  };
  return { latest, recover, failed, setFailed };
}

function MediaError({ retry }: { retry: () => void }) {
  return (
    <span role="alert">
      媒体加载失败{" "}
      <Button type="button" variant="link" size="sm" onClick={retry}>
        重试
      </Button>
    </span>
  );
}

export function SignedImage({ src, onError, ...props }: ComponentProps<"img">) {
  const media = useSignedSource(src);
  const [attempt, setAttempt] = useState(0);
  const retry = () => {
    media.setFailed(false);
    setAttempt((n) => n + 1);
  };
  return (
    <>
      <img
        {...props}
        key={attempt}
        src={media.latest}
        onError={(event) => {
          const element = event.currentTarget;
          const failedUrl = element.src;
          void media.recover().then((url) => {
            if (url && url !== failedUrl) element.src = url;
            else {
              media.setFailed(true);
              onError?.(event);
            }
          });
        }}
      />
      {media.failed && (
        <MediaError
          retry={() => {
            void freshMediaUrl(src ?? "", true)
              .then(retry)
              .catch(() => media.setFailed(true));
          }}
        />
      )}
    </>
  );
}

/** Hold a playing source across background renewals; swap only on recovery. */
function usePlaybackSource(src?: string) {
  const media = useSignedSource(src);
  const [held, setHeld] = useState({ identity: mediaIdentity(src ?? ""), url: media.latest });
  const identity = mediaIdentity(src ?? "");
  const active = useRef(false);
  const source = held.identity === identity ? held.url : media.latest;
  useEffect(() => {
    if (held.identity !== identity) {
      active.current = false;
      setHeld({ identity, url: media.latest });
    } else if (!active.current && source !== media.latest) setHeld({ identity, url: media.latest });
  }, [held.identity, identity, media.latest, source]);
  const restore = (element: HTMLMediaElement, url: string) => {
    const time = element.currentTime;
    const playing = !element.paused;
    setHeld({ identity, url });
    element.addEventListener(
      "loadedmetadata",
      () => {
        element.currentTime = time;
        if (playing) void element.play().catch(() => undefined);
      },
      { once: true },
    );
    element.src = url;
    element.load();
  };
  const recover = (event: SyntheticEvent<HTMLMediaElement>) => {
    const element = event.currentTarget;
    const failedUrl = element.src;
    return media.recover().then((url) => {
      if (url && url !== failedUrl) {
        restore(element, url);
        return true;
      }
      media.setFailed(true);
      return false;
    });
  };
  const retry = (element: HTMLMediaElement | null) => {
    if (!element) return;
    void freshMediaUrl(src ?? "", true)
      .then((url) => {
        media.setFailed(false);
        restore(element, url);
      })
      .catch(() => media.setFailed(true));
  };
  return { source, active, recover, failed: media.failed, retry };
}

export function SignedVideo({
  src,
  poster,
  onError,
  onPlay,
  ref,
  ...props
}: ComponentProps<"video">) {
  const media = usePlaybackSource(src);
  const posterMedia = useSignedSource(poster);
  const element = useRef<HTMLVideoElement | null>(null);
  return (
    <>
      <video
        {...props}
        src={media.source}
        poster={posterMedia.latest}
        ref={(node) => {
          element.current = node;
          if (typeof ref === "function") return ref(node);
          if (ref) ref.current = node;
        }}
        onPlay={(event) => {
          media.active.current = true;
          onPlay?.(event);
        }}
        onError={(event) => {
          void media.recover(event).then((ok) => {
            if (!ok) onError?.(event);
          });
        }}
      />
      {media.failed && <MediaError retry={() => media.retry(element.current)} />}
    </>
  );
}

export function SignedAudio({ src, onError, onPlay, ref, ...props }: ComponentProps<"audio">) {
  const media = usePlaybackSource(src);
  const element = useRef<HTMLAudioElement | null>(null);
  return (
    <>
      <audio
        {...props}
        src={media.source}
        ref={(node) => {
          element.current = node;
          if (typeof ref === "function") return ref(node);
          if (ref) ref.current = node;
        }}
        onPlay={(event) => {
          media.active.current = true;
          onPlay?.(event);
        }}
        onError={(event) => {
          void media.recover(event).then((ok) => {
            if (!ok) onError?.(event);
          });
        }}
      />
      {media.failed && <MediaError retry={() => media.retry(element.current)} />}
    </>
  );
}
