import { useCallback, useRef, useState } from "react";
import {
  Play,
  Pause,
  Maximize,
  Minimize,
  AArrowUp,
  Columns3,
} from "lucide-react";
import { formatTime, throttle } from "~/lib/utils";
import type { Marker } from "~/lib/playback-engine";

const SPEED_OPTIONS = [0.5, 1, 1.5, 2, 4, 8];
const FONT_SIZE_OPTIONS = [16, 18, 20, 24, 28, 32];
const COLS_OPTIONS = [80, 120, 160, 200];

interface ControlBarProps {
  visible: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  progress: number;
  speed: number;
  markers: Marker[];
  isFullscreen: boolean;
  onPlayClick: () => void;
  onSeek: (time: number) => void;
  onSeekPercent: (percent: number) => void;
  onSpeedChange: (speed: number) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  displayCols: number;
  onDisplayColsChange: (cols: number) => void;
  onToggleFullscreen: () => void;
}

export function ControlBar({
  visible,
  isPlaying,
  currentTime,
  duration,
  progress,
  speed,
  markers,
  isFullscreen,
  onPlayClick,
  onSeek,
  onSeekPercent,
  onSpeedChange,
  fontSize,
  onFontSizeChange,
  displayCols,
  onDisplayColsChange,
  onToggleFullscreen,
}: ControlBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showRemaining, setShowRemaining] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showColsMenu, setShowColsMenu] = useState(false);

  const throttledSeek = useRef(
    throttle((pct: number) => onSeekPercent(pct), 50),
  ).current;

  const calcPercent = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      if (!barRef.current) return 0;
      const rect = barRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      return Math.max(0, Math.min(100, (x / rect.width) * 100));
    },
    [],
  );

  const handleBarMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setIsDragging(true);
      const pct = calcPercent(e);
      onSeekPercent(pct);

      const onMove = (ev: MouseEvent) => {
        const p = calcPercent(ev);
        throttledSeek(p);
      };

      const onUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [calcPercent, onSeekPercent, throttledSeek],
  );

  const handleMarkerClick = useCallback(
    (time: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSeek(time);
    },
    [onSeek],
  );

  const remaining = duration - Math.min(currentTime, duration);

  return (
    <div
      className={`flex h-8 items-center gap-2 bg-black/80 px-2 backdrop-blur-sm transition-opacity duration-200 ${
        visible || isDragging ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Play/Pause */}
      <button
        type="button"
        onClick={onPlayClick}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/80 transition-colors hover:text-white"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
      </button>

      {/* Timer */}
      <button
        type="button"
        onClick={() => setShowRemaining((v) => !v)}
        className="shrink-0 select-none font-mono text-xs tabular-nums text-white/70"
        aria-label="Toggle time display"
      >
        {showRemaining
          ? `-${formatTime(remaining)}`
          : formatTime(currentTime)}
      </button>

      {/* Progress bar */}
      <div
        ref={barRef}
        className="relative flex h-full flex-1 cursor-pointer items-center"
        onMouseDown={handleBarMouseDown}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div className="relative h-1 w-full rounded-full bg-white/20">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-emerald-400 transition-[width] duration-75"
            style={{ width: `${progress * 100}%` }}
          />

          {markers.map((m, i) => {
            const pct = duration > 0 ? (m.time / duration) * 100 : 0;
            const isPast = currentTime >= m.time;

            return (
              <button
                type="button"
                key={i}
                className={`absolute top-1/2 z-10 h-2.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm transition-colors ${
                  isPast ? "bg-emerald-300" : "bg-white/50"
                } hover:bg-white`}
                style={{ left: `${pct}%` }}
                onClick={handleMarkerClick(m.time)}
                title={
                  m.label
                    ? `${formatTime(m.time)} - ${m.label}`
                    : formatTime(m.time)
                }
              />
            );
          })}
        </div>
      </div>

      {/* Duration */}
      <span className="shrink-0 font-mono text-xs tabular-nums text-white/50">
        {formatTime(duration)}
      </span>

      {/* Speed control */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowSpeedMenu((v) => !v)}
          onBlur={() => setTimeout(() => setShowSpeedMenu(false), 150)}
          className="flex h-6 shrink-0 items-center justify-center rounded px-1.5 font-mono text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Playback speed"
        >
          {speed}x
        </button>

        {showSpeedMenu && (
          <div className="absolute bottom-full right-0 mb-1 rounded-lg border border-white/10 bg-zinc-900 py-1 shadow-xl">
            {SPEED_OPTIONS.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => {
                  onSpeedChange(s);
                  setShowSpeedMenu(false);
                }}
                className={`block w-full px-4 py-1 text-left font-mono text-xs transition-colors ${
                  s === speed
                    ? "bg-emerald-400/20 text-emerald-400"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Font size control */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowFontMenu((v) => !v)}
          onBlur={() => setTimeout(() => setShowFontMenu(false), 150)}
          className="flex h-6 shrink-0 items-center justify-center gap-0.5 rounded px-1.5 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Font size"
          title="Font size"
        >
          <AArrowUp size={14} />
          <span className="font-mono">{fontSize}</span>
        </button>

        {showFontMenu && (
          <div className="absolute bottom-full right-0 mb-1 rounded-lg border border-white/10 bg-zinc-900 py-1 shadow-xl">
            {FONT_SIZE_OPTIONS.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => {
                  onFontSizeChange(s);
                  setShowFontMenu(false);
                }}
                className={`block w-full px-4 py-1 text-left font-mono text-xs transition-colors ${
                  s === fontSize
                    ? "bg-emerald-400/20 text-emerald-400"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {s}px
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Columns control */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowColsMenu((v) => !v)}
          onBlur={() => setTimeout(() => setShowColsMenu(false), 150)}
          className="flex h-6 shrink-0 items-center justify-center gap-0.5 rounded px-1.5 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Column width"
          title="Column width"
        >
          <Columns3 size={14} />
          <span className="font-mono">{displayCols}</span>
        </button>

        {showColsMenu && (
          <div className="absolute bottom-full right-0 mb-1 rounded-lg border border-white/10 bg-zinc-900 py-1 shadow-xl">
            {COLS_OPTIONS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => {
                  onDisplayColsChange(c);
                  setShowColsMenu(false);
                }}
                className={`block w-full px-4 py-1 text-left font-mono text-xs transition-colors ${
                  c === displayCols
                    ? "bg-emerald-400/20 text-emerald-400"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {c} cols
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen */}
      <button
        type="button"
        onClick={onToggleFullscreen}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/80 transition-colors hover:text-white"
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      >
        {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
      </button>
    </div>
  );
}
