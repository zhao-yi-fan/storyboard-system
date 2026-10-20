import {
  type HTMLAttributes,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const MIN_WIDTH = 320;
const MAX_WIDTH = 560;
const clamp = (width: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));

export function useResizableDetailSidebar(enabled = true) {
  const [detailSidebarWidth, setDetailSidebarWidth] = useState(384);
  const [isResizingDetailSidebar, setResizing] = useState(false);
  const [pointerFocus, setPointerFocus] = useState(false);
  const drag = useRef<{
    x: number;
    width: number;
    pointerId: number;
    target: HTMLDivElement;
    restore: () => void;
  } | null>(null);

  const release = useCallback(() => {
    const current = drag.current;
    drag.current = null;
    if (current) {
      current.restore();
      if (current.target.hasPointerCapture(current.pointerId))
        current.target.releasePointerCapture(current.pointerId);
    }
  }, []);
  const stop = () => {
    release();
    setResizing(false);
  };
  useEffect(() => {
    const cancel = () => {
      release();
      setResizing(false);
    };
    const resize = () => {
      if (window.innerWidth <= 800) cancel();
    };
    if (!enabled) cancel();
    window.addEventListener("resize", resize);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("blur", cancel);
      release();
    };
  }, [enabled, release]);

  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) stop();
  };
  const resizeHandleProps: HTMLAttributes<HTMLDivElement> & { "data-pointer-focus"?: boolean } = {
    role: "separator",
    tabIndex: 0,
    "data-pointer-focus": pointerFocus || undefined,
    onBlur: () => setPointerFocus(false),
    "aria-label": "调整资产编辑面板宽度",
    "aria-orientation": "vertical",
    "aria-valuemin": MIN_WIDTH,
    "aria-valuemax": MAX_WIDTH,
    "aria-valuenow": detailSidebarWidth,
    "aria-valuetext": `${detailSidebarWidth} 像素`,
    onPointerDown: (event) => {
      if (!enabled || window.innerWidth <= 800 || event.button !== 0 || drag.current) return;
      event.preventDefault();
      event.currentTarget.focus();
      setPointerFocus(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      const { cursor, userSelect } = document.body.style;
      drag.current = {
        x: event.clientX,
        width: detailSidebarWidth,
        pointerId: event.pointerId,
        target: event.currentTarget,
        restore: () => {
          document.body.style.cursor = cursor;
          document.body.style.userSelect = userSelect;
        },
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      setResizing(true);
    },
    onPointerMove: (event) => {
      const current = drag.current;
      if (current?.pointerId === event.pointerId)
        setDetailSidebarWidth(clamp(current.width + current.x - event.clientX));
    },
    onPointerUp: finish,
    onPointerCancel: finish,
    onLostPointerCapture: finish,
    onKeyDown: (event) => {
      setPointerFocus(false);
      if (
        !enabled ||
        window.innerWidth <= 800 ||
        !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
      )
        return;
      event.preventDefault();
      stop();
      setDetailSidebarWidth((width) =>
        event.key === "Home"
          ? MIN_WIDTH
          : event.key === "End"
            ? MAX_WIDTH
            : clamp(width + (event.key === "ArrowLeft" ? 16 : -16)),
      );
    },
  };
  return { detailSidebarWidth, isResizingDetailSidebar, resizeHandleProps };
}
