import { Play, AlertCircle, Loader2 } from "lucide-react";
import type { PlaybackState } from "~/lib/playback-engine";

interface PlayerOverlayProps {
  loadState: "idle" | "loading" | "ready" | "error";
  playbackState: PlaybackState;
  errorMessage: string | null;
  onPlay: () => void;
}

export function PlayerOverlay({
  loadState,
  playbackState,
  errorMessage,
  onPlay,
}: PlayerOverlayProps) {
  if (loadState === "loading") {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
        <Loader2 className="h-10 w-10 animate-spin text-white/60" />
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="max-w-xs text-center text-sm text-white/80">
          {errorMessage ?? "Failed to load recording"}
        </p>
      </div>
    );
  }

  if (
    loadState === "ready" &&
    (playbackState === "idle" || playbackState === "ended")
  ) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <button
          type="button"
          onClick={onPlay}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:scale-110 hover:bg-white/20"
          aria-label="Play"
        >
          <Play size={28} className="ml-1" />
        </button>
      </div>
    );
  }

  return null;
}
