# asciinema wterm viewer

A modern terminal session recording player built with [wterm](https://github.com/vercel-labs/wterm) as the terminal rendering engine.

This is a reimplementation of [asciinema-player](https://github.com/asciinema/asciinema-player) that replaces the Rust/WASM terminal emulator with wterm's Zig/WASM renderer for DOM-native terminal output with proper text selection, accessibility, and theming.

## Tech Stack

- **Terminal**: [@wterm/react](https://github.com/vercel-labs/wterm) — Zig+WASM terminal emulator rendering to the DOM
- **Framework**: [TanStack Start](https://tanstack.com/start) (SPA mode) + [Vite](https://vite.dev/)
- **UI**: [React](https://react.dev/) + [Tailwind CSS](https://tailwindcss.com/) + [Lucide icons](https://lucide.dev/)
- **Language**: TypeScript (strict mode)

## Features

- **Asciicast v1/v2/v3 support** — Full parser for all asciinema recording formats
- **Playback controls** — Play, pause, seek, speed control (0.5x–8x), progress scrubber
- **Keyboard shortcuts** — Space (play/pause), arrow keys (seek), f (fullscreen), 0-9 (seek %), and more
- **Markers** — Visual markers on the progress bar with labels
- **Idle time optimization** — Configurable limit to compress long pauses
- **Poster** — Render a frame at a specific time before playback starts
- **Fullscreen** — Native fullscreen support with responsive scaling
- **Responsive** — Auto-scales terminal to fit container width
- **Loop** — Optional looping playback

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Type-check
npm run typecheck

# Build for production
npm run build
```

## Usage

### `AsciinemaPlayer` Component

```tsx
import { AsciinemaPlayer } from "~/components/AsciinemaPlayer";

<AsciinemaPlayer
  src="https://asciinema.org/a/569727.cast?dl=1"
  fit="width"
  autoPlay={false}
  loop={false}
  speed={1}
  controls="auto"
  fontSize={14}
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | — | URL or inline string of an asciicast recording |
| `fit` | `"width" \| "height" \| "both" \| "none"` | `"width"` | How to scale the terminal to fit the container |
| `autoPlay` | `boolean` | `false` | Auto-start playback |
| `loop` | `boolean` | `false` | Loop playback |
| `speed` | `number` | `1` | Playback speed multiplier |
| `idleTimeLimit` | `number` | — | Max idle time between events (seconds) |
| `posterTime` | `number` | — | Time (seconds) to render as poster before playback |
| `theme` | `string` | — | wterm theme name |
| `fontSize` | `number` | `14` | Terminal font size in pixels |
| `controls` | `boolean \| "auto"` | `true` | Show controls. `"auto"` shows on hover/pause |
| `className` | `string` | — | Additional CSS class |
| `style` | `CSSProperties` | — | Additional inline styles |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `←` / `→` | Seek ±5 seconds |
| `Shift+←` / `Shift+→` | Seek ±10% |
| `f` | Toggle fullscreen |
| `,` / `.` | Step one frame backward / forward |
| `0`–`9` | Seek to 0%–90% |
| `[` / `]` | Previous / next marker |

## Architecture

```
src/
├── components/
│   ├── AsciinemaPlayer.tsx   # Main player component
│   ├── ControlBar.tsx        # Playback controls (play, seek, speed, fullscreen)
│   └── PlayerOverlay.tsx     # Loading, error, and play overlays
├── lib/
│   ├── asciicast-parser.ts   # Asciicast v1/v2/v3 parser
│   ├── playback-engine.ts    # Timing, seeking, speed, markers, looping
│   ├── use-keyboard-shortcuts.ts
│   └── utils.ts
├── routes/
│   ├── __root.tsx            # Root layout
│   └── index.tsx             # Demo page
└── styles/
    └── globals.css           # Tailwind + terminal CSS variables
```

## Credits

- [asciinema-player](https://github.com/asciinema/asciinema-player) — Original player, parser logic, and playback architecture (Apache-2.0)
- [wterm](https://github.com/vercel-labs/wterm) — Terminal emulator engine

## License

Apache-2.0
