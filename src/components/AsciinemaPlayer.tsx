import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type CSSProperties,
} from "react";
import { Terminal, type TerminalHandle } from "@wterm/react";
import { PlaybackEngine, type PlaybackState } from "~/lib/playback-engine";
import {
  parseAsciicast,
  type ParsedRecording,
} from "~/lib/asciicast-parser";
import { ControlBar } from "./ControlBar";
import { PlayerOverlay } from "./PlayerOverlay";
import { useKeyboardShortcuts } from "~/lib/use-keyboard-shortcuts";

export interface AsciinemaPlayerProps {
  /** URL of an asciicast recording (.cast/.asciicast file) */
  src?: string;
  /** Raw recording content as a string (alternative to src URL) */
  content?: string;
  /** Fit mode: "width" | "height" | "both" | "none" */
  fit?: "width" | "height" | "both" | "none";
  /** Auto-start playback */
  autoPlay?: boolean;
  /** Loop playback */
  loop?: boolean;
  /** Playback speed multiplier */
  speed?: number;
  /** Idle time limit in seconds */
  idleTimeLimit?: number;
  /** Time (seconds) to display as poster */
  posterTime?: number;
  /** wterm theme name */
  theme?: string;
  /** Terminal font size in px */
  fontSize?: number;
  /** Show controls */
  controls?: boolean | "auto";
  /** Additional class name */
  className?: string;
  /** Additional style */
  style?: CSSProperties;
}

type LoadState = "idle" | "loading" | "ready" | "error";

export function AsciinemaPlayer({
  src,
  content,
  fit = "width",
  autoPlay = false,
  loop = false,
  speed = 1,
  idleTimeLimit,
  posterTime,
  theme,
  fontSize = 14,
  controls = true,
  className,
  style,
}: AsciinemaPlayerProps) {
  const terminalRef = useRef<TerminalHandle>(null);
  const engineRef = useRef<PlaybackEngine | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const recordingRef = useRef<ParsedRecording | null>(null);

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [termCols, setTermCols] = useState(80);
  const [termRows, setTermRows] = useState(24);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scale, setScale] = useState(1);
  const [userActive, setUserActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState(speed);

  const userActiveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeUpdateRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const controlsVisible =
    controls === true ||
    (controls === "auto" && (userActive || playbackState !== "playing"));

  // Load recording
  useEffect(() => {
    const source = content ?? src ?? "";
    if (source === "") return;

    let cancelled = false;

    // Destroy previous engine on source change
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }

    async function load() {
      setLoadState("loading");
      setPlaybackState("idle");
      setCurrentTime(0);

      try {
        let data: string | Response;

        if (!content && (source.startsWith("http://") || source.startsWith("https://") || source.startsWith("/"))) {
          data = await fetch(source);
          if (!(data as Response).ok) {
            throw new Error(`Failed to fetch: ${(data as Response).status}`);
          }
        } else {
          data = source;
        }

        if (cancelled) return;

        const recording = await parseAsciicast(data);

        if (idleTimeLimit !== undefined) {
          recording.idleTimeLimit = idleTimeLimit;
        }

        recordingRef.current = recording;
        setTermCols(recording.cols);
        setTermRows(recording.rows);
        setDuration(recording.duration);
        setLoadState("ready");
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(
            err instanceof Error ? err.message : "Failed to load recording",
          );
          setLoadState("error");
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [src, content, idleTimeLimit]);

  // Initialize engine when terminal is ready
  const onTerminalReady = useCallback((_wt: unknown) => {
    const recording = recordingRef.current;
    if (!recording) return;

    const engine = new PlaybackEngine(recording);
    engineRef.current = engine;

    engine.on("output", (data) => {
      if (!terminalRef.current) return;

      if (Array.isArray(data)) {
        for (const chunk of data) {
          terminalRef.current.write(chunk);
        }
      } else {
        terminalRef.current.write(data);
      }
    });

    engine.on("reset", () => {
      terminalRef.current?.write("\x1bc");
    });

    engine.on("resize", ({ cols, rows }) => {
      setTermCols(cols);
      setTermRows(rows);
      terminalRef.current?.resize(cols, rows);
    });

    engine.on("stateChange", (state) => {
      setPlaybackState(state);
    });

    engine.on("timeUpdate", (time) => {
      setCurrentTime(time);
    });

    engine.speed = speed;
    engine.loop = loop;

    if (posterTime !== undefined) {
      engine.renderPosterAt(posterTime);
    }

    if (autoPlay) {
      engine.play();
    }
  }, [autoPlay, loop, speed, posterTime]);

  // Sync speed/loop changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.speed = speed;
    }
  }, [speed]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.loop = loop;
    }
  }, [loop]);

  // Time update interval when playing
  useEffect(() => {
    if (playbackState === "playing") {
      timeUpdateRef.current = setInterval(() => {
        if (engineRef.current) {
          setCurrentTime(engineRef.current.currentTime);
        }
      }, 100);
    } else {
      if (timeUpdateRef.current) {
        clearInterval(timeUpdateRef.current);
        timeUpdateRef.current = null;
      }
    }

    return () => {
      if (timeUpdateRef.current) {
        clearInterval(timeUpdateRef.current);
      }
    };
  }, [playbackState]);

  // Fullscreen tracking
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(
        document.fullscreenElement === wrapperRef.current,
      );
    };

    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, []);

  // Resize observer for scaling
  useEffect(() => {
    if (!wrapperRef.current) return;

    const charW = fontSize * 0.6;
    const charH = fontSize * 1.3333;
    const borderPadding = 32;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const containerW = entry.contentRect.width;
        const containerH = entry.contentRect.height;
        const termW = charW * termCols + borderPadding;
        const termH = charH * termRows + borderPadding;

        let newScale = 1;
        const effectiveFit = isFullscreen ? "both" : fit;

        if (effectiveFit === "width") {
          newScale = containerW / termW;
        } else if (effectiveFit === "height") {
          newScale = (containerH - 32) / termH;
        } else if (effectiveFit === "both") {
          const scaleW = containerW / termW;
          const scaleH = (containerH - 32) / termH;
          newScale = Math.min(scaleW, scaleH);
        }

        if (effectiveFit !== "none") {
          setScale(Math.max(0.1, newScale));
        }
      }
    });

    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [fit, fontSize, termCols, termRows, isFullscreen]);

  // User activity tracking
  const onMouseMove = useCallback(() => {
    setUserActive(true);
    if (userActiveTimeoutRef.current) {
      clearTimeout(userActiveTimeoutRef.current);
    }
    userActiveTimeoutRef.current = setTimeout(() => {
      setUserActive(false);
    }, 2000);
  }, []);

  // Player controls
  const handlePlay = useCallback(() => {
    engineRef.current?.togglePlay();
  }, []);

  const handleSeek = useCallback((time: number) => {
    engineRef.current?.seek(time);
  }, []);

  const handleSeekPercent = useCallback((percent: number) => {
    engineRef.current?.seekPercent(percent);
  }, []);

  const handleSpeedChange = useCallback((newSpeed: number) => {
    setCurrentSpeed(newSpeed);
    if (engineRef.current) {
      engineRef.current.speed = newSpeed;
    }
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (!wrapperRef.current) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      wrapperRef.current.requestFullscreen();
    }
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts(wrapperRef, {
    onTogglePlay: handlePlay,
    onSeekForward: () => engineRef.current?.seekRelative(5),
    onSeekBackward: () => engineRef.current?.seekRelative(-5),
    onSeekForwardLarge: () => engineRef.current?.seekRelative(duration * 0.1),
    onSeekBackwardLarge: () => engineRef.current?.seekRelative(-(duration * 0.1)),
    onToggleFullscreen: handleToggleFullscreen,
    onStepForward: () => engineRef.current?.step(1),
    onStepBackward: () => engineRef.current?.step(-1),
    onSeekPercent: (pct) => engineRef.current?.seekPercent(pct),
    onPrevMarker: () => engineRef.current?.seekToMarker("prev"),
    onNextMarker: () => engineRef.current?.seekToMarker("next"),
  });

  // Cleanup
  useEffect(() => {
    return () => {
      engineRef.current?.destroy();
    };
  }, []);

  const terminalScale = fit === "none" ? 1 : scale;

  return (
    <div
      ref={wrapperRef}
      className={`relative overflow-hidden rounded-lg bg-[var(--term-bg)] shadow-2xl ${isFullscreen ? "flex flex-col items-center justify-center" : ""} ${className ?? ""}`}
      style={style}
      onMouseMove={onMouseMove}
      tabIndex={0}
    >
      {/* Terminal area */}
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={{
          transform: `scale(${terminalScale})`,
          transformOrigin: "top left",
          width: `${100 / terminalScale}%`,
          height: fit === "none" ? undefined : `calc((100% - 32px) / ${terminalScale})`,
        }}
      >
        {loadState === "ready" && (
          <Terminal
            ref={terminalRef}
            cols={termCols}
            rows={termRows}
            theme={theme || undefined}
            cursorBlink={false}
            autoResize={false}
            onReady={onTerminalReady}
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: "1.3333",
              width: "100%",
              height: "100%",
            }}
          />
        )}
      </div>

      {/* Overlays */}
      <PlayerOverlay
        loadState={loadState}
        playbackState={playbackState}
        errorMessage={errorMessage}
        onPlay={handlePlay}
      />

      {/* Control bar */}
      {controls !== false && (
        <ControlBar
          visible={controlsVisible}
          isPlaying={playbackState === "playing"}
          currentTime={currentTime}
          duration={duration}
          progress={duration > 0 ? currentTime / duration : 0}
          speed={currentSpeed}
          markers={engineRef.current?.markers ?? []}
          isFullscreen={isFullscreen}
          onPlayClick={handlePlay}
          onSeek={handleSeek}
          onSeekPercent={handleSeekPercent}
          onSpeedChange={handleSpeedChange}
          onToggleFullscreen={handleToggleFullscreen}
        />
      )}
    </div>
  );
}
