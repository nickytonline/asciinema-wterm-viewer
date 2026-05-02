import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import { Upload } from "lucide-react";
import { AsciinemaPlayer } from "~/components/AsciinemaPlayer";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const DEMO_RECORDING_URL =
  "https://asciinema.org/a/569727.cast?dl=1";

function HomePage() {
  const [url, setUrl] = useState(DEMO_RECORDING_URL);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [inputUrl, setInputUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === "string") {
        setFileContent(text);
        setFileName(file.name);
        setUrl("");
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        loadFile(file);
      }
    },
    [loadFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        loadFile(file);
      }
    },
    [loadFile],
  );

  const handleLoadUrl = useCallback(() => {
    if (inputUrl.trim()) {
      setUrl(inputUrl.trim());
      setFileContent(null);
      setFileName(null);
    }
  }, [inputUrl]);

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 p-6">
      {/* Header */}
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          asciinema wterm viewer
        </h1>
        <p className="text-sm text-white/60">
          A modern terminal session recording player powered by{" "}
          <a
            href="https://github.com/vercel-labs/wterm"
            className="text-emerald-400 underline decoration-emerald-400/30 hover:decoration-emerald-400"
            target="_blank"
            rel="noopener noreferrer"
          >
            wterm
          </a>
        </p>
      </header>

      {/* Load controls */}
      <div className="flex flex-col gap-3">
        {/* Drop zone / file picker */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-4 text-sm transition-colors ${
            isDragging
              ? "border-emerald-400 bg-emerald-400/10 text-emerald-400"
              : "border-white/20 bg-white/5 text-white/50 hover:border-white/40 hover:text-white/70"
          }`}
        >
          <Upload size={18} />
          <span>
            {fileName
              ? `Loaded: ${fileName}`
              : "Drop a .cast or .asciicast file here, or click to browse"}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".cast,.asciicast"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* URL input */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">or</span>
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLoadUrl();
            }}
            placeholder="Paste a .cast file URL..."
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
          />
          <button
            type="button"
            onClick={handleLoadUrl}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
          >
            Load URL
          </button>
        </div>
      </div>

      {/* Player */}
      <AsciinemaPlayer
        src={fileContent ? undefined : url}
        content={fileContent ?? undefined}
        fit="width"
        controls="auto"
        theme="default"
        fontSize={16}
        style={{ maxWidth: "100%" }}
      />

      {/* Keyboard shortcuts help */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 text-sm font-semibold text-white/80">
          Keyboard Shortcuts
        </h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-white/50 sm:grid-cols-3">
          <div>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/70">
              Space
            </kbd>{" "}
            Play / Pause
          </div>
          <div>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/70">
              &larr;
            </kbd>{" "}
            /{" "}
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/70">
              &rarr;
            </kbd>{" "}
            Seek &plusmn;5s
          </div>
          <div>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/70">
              Shift+&larr;
            </kbd>{" "}
            /{" "}
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/70">
              Shift+&rarr;
            </kbd>{" "}
            Seek &plusmn;10%
          </div>
          <div>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/70">
              f
            </kbd>{" "}
            Fullscreen
          </div>
          <div>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/70">
              ,
            </kbd>{" "}
            /{" "}
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/70">
              .
            </kbd>{" "}
            Step frame
          </div>
          <div>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/70">
              0-9
            </kbd>{" "}
            Seek to 0-90%
          </div>
          <div>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/70">
              [
            </kbd>{" "}
            /{" "}
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/70">
              ]
            </kbd>{" "}
            Prev / Next marker
          </div>
        </div>
      </div>
    </div>
  );
}
