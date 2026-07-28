import { useCallback, useEffect, useRef, useState } from "react";
import { sceneApi, type Scene, type SceneMediaGeneration } from "../../../api";

export type SceneVideoPollingStatus = "idle" | "polling" | "succeeded" | "failed";

type SceneVideoPollingCallbacks = {
  onScene: (scene: Scene) => void;
  onGenerations: (generations: SceneMediaGeneration[]) => void;
  onTerminal: (scene: Scene) => void;
  onError: (error: unknown) => void;
};

export function useSceneVideoPolling(callbacks: SceneVideoPollingCallbacks) {
  const timerRef = useRef<number | null>(null);
  const callbacksRef = useRef(callbacks);
  const [status, setStatus] = useState<SceneVideoPollingStatus>("idle");

  callbacksRef.current = callbacks;

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback((sceneId: number) => {
    stop();
    setStatus("polling");
    timerRef.current = window.setInterval(async () => {
      try {
        const latest = await sceneApi.getScene(sceneId);
        callbacksRef.current.onScene(latest);
        const generations = await sceneApi.getSceneMediaGenerations(sceneId);
        callbacksRef.current.onGenerations(generations);
        if (latest.video_status !== "generating") {
          stop();
          setStatus("succeeded");
          callbacksRef.current.onTerminal(latest);
        }
      } catch (error) {
        stop();
        setStatus("failed");
        callbacksRef.current.onError(error);
      }
    }, 5000);
  }, [stop]);

  useEffect(
    () => () => {
      stop();
    },
    [stop],
  );

  return { status, start, stop };
}
