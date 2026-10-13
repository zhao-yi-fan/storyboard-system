import { useEffect, useSyncExternalStore } from "react";

import { currentMediaUrl, freshMediaUrl, subscribeMedia } from "../../lib/signedMedia";

export function useSignedMediaUrls(urls: string[], enabled: boolean): string[] {
  const sources = JSON.stringify(enabled ? urls : []);
  const snapshot = useSyncExternalStore(
    (notify) => {
      const unsubscribe = (JSON.parse(sources) as string[]).map((src) =>
        subscribeMedia(src, notify),
      );
      return () => unsubscribe.forEach((stop) => stop());
    },
    () => JSON.stringify((JSON.parse(sources) as string[]).map(currentMediaUrl)),
  );
  useEffect(() => {
    for (const url of JSON.parse(sources) as string[])
      void freshMediaUrl(url).catch(() => undefined);
  }, [sources]);
  return enabled ? (JSON.parse(snapshot) as string[]) : urls;
}
