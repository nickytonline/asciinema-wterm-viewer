import { useEffect, type RefObject } from "react";

interface KeyboardActions {
  onTogglePlay: () => void;
  onSeekForward: () => void;
  onSeekBackward: () => void;
  onSeekForwardLarge: () => void;
  onSeekBackwardLarge: () => void;
  onToggleFullscreen: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onSeekPercent: (pct: number) => void;
  onPrevMarker: () => void;
  onNextMarker: () => void;
}

export function useKeyboardShortcuts(
  containerRef: RefObject<HTMLElement | null>,
  actions: KeyboardActions,
) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.altKey || e.metaKey || e.ctrlKey) return;

      switch (e.key) {
        case " ":
          actions.onTogglePlay();
          break;
        case "ArrowRight":
          if (e.shiftKey) {
            actions.onSeekForwardLarge();
          } else {
            actions.onSeekForward();
          }
          break;
        case "ArrowLeft":
          if (e.shiftKey) {
            actions.onSeekBackwardLarge();
          } else {
            actions.onSeekBackward();
          }
          break;
        case "f":
          actions.onToggleFullscreen();
          break;
        case ".":
          actions.onStepForward();
          break;
        case ",":
          actions.onStepBackward();
          break;
        case "[":
          actions.onPrevMarker();
          break;
        case "]":
          actions.onNextMarker();
          break;
        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9": {
          const pct = parseInt(e.key, 10) * 10;
          actions.onSeekPercent(pct);
          break;
        }
        default:
          return;
      }

      e.stopPropagation();
      e.preventDefault();
    }

    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [containerRef, actions]);
}
