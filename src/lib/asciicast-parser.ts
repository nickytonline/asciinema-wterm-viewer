/**
 * Asciicast parser supporting v1, v2, and v3 formats.
 * Ported from asciinema-player (Apache-2.0 license).
 */

export type EventType = "o" | "i" | "r" | "m";

/** A parsed asciicast event: [time_seconds, type, data] */
export type AsciicastEvent = [number, EventType, string];

export interface MarkerData {
  label: string;
}

export interface ParsedRecording {
  cols: number;
  rows: number;
  events: AsciicastEvent[];
  duration: number;
  theme?: ParsedTheme;
  idleTimeLimit?: number;
}

export interface ParsedTheme {
  foreground: string;
  background: string;
  palette: string[];
}

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;

interface AsciicastV1Header {
  version: 1;
  width: number;
  height: number;
  stdout: [number, string][];
}

interface AsciicastV2Header {
  version: 2;
  width: number;
  height: number;
  theme?: { fg?: string; bg?: string; palette?: string };
  idle_time_limit?: number;
}

interface AsciicastV3Header {
  version: 3;
  term: {
    cols: number;
    rows: number;
    theme?: { fg?: string; bg?: string; palette?: string };
  };
  idle_time_limit?: number;
}

type AsciicastHeader = AsciicastV1Header | AsciicastV2Header | AsciicastV3Header;

export async function parseAsciicast(
  input: string | Response,
): Promise<ParsedRecording> {
  let text: string;

  if (input instanceof Response) {
    text = await input.text();
  } else {
    text = input;
  }

  const jsonl = parseJsonl(text);

  if (jsonl) {
    const { header, events } = jsonl;

    if (header.version === 2) {
      return parseV2(header as AsciicastV2Header, events);
    } else if (header.version === 3) {
      return parseV3(header as AsciicastV3Header, events);
    } else {
      throw new Error(`asciicast v${header.version} format not supported`);
    }
  }

  const header = JSON.parse(text) as AsciicastHeader;

  if (header.version === 1) {
    return parseV1(header as AsciicastV1Header);
  }

  throw new Error("invalid asciicast data");
}

function parseJsonl(
  text: string,
): { header: AsciicastHeader; events: unknown[][] } | undefined {
  const lines = text.split("\n");
  let header: AsciicastHeader;

  try {
    header = JSON.parse(lines[0]) as AsciicastHeader;
  } catch {
    return undefined;
  }

  if (!header || typeof header !== "object" || !("version" in header)) {
    return undefined;
  }

  const events: unknown[][] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 0 && line[0] === "[") {
      events.push(JSON.parse(line) as unknown[]);
    }
  }

  return { header, events };
}

function parseV1(data: AsciicastV1Header): ParsedRecording {
  let time = 0;
  const events: AsciicastEvent[] = [];

  for (const entry of data.stdout) {
    time += entry[0];
    events.push([time, "o", entry[1]]);
  }

  const duration = events.length > 0 ? events[events.length - 1][0] : 0;

  return {
    cols: data.width === 0 ? DEFAULT_COLS : data.width,
    rows: data.height === 0 ? DEFAULT_ROWS : data.height,
    events,
    duration,
  };
}

function parseV2(
  header: AsciicastV2Header,
  rawEvents: unknown[][],
): ParsedRecording {
  const events: AsciicastEvent[] = rawEvents.map(
    (e) => [e[0] as number, e[1] as EventType, e[2] as string],
  );

  const duration =
    events.length > 0 ? events[events.length - 1][0] : 0;

  return {
    cols: header.width === 0 ? DEFAULT_COLS : header.width,
    rows: header.height === 0 ? DEFAULT_ROWS : header.height,
    theme: parseTheme(header.theme),
    events,
    duration,
    idleTimeLimit: header.idle_time_limit,
  };
}

function parseV3(
  header: AsciicastV3Header,
  rawEvents: unknown[][],
): ParsedRecording {
  let time = 0;
  const events: AsciicastEvent[] = [];

  for (const e of rawEvents) {
    time += e[0] as number;
    events.push([time, e[1] as EventType, e[2] as string]);
  }

  const duration = events.length > 0 ? events[events.length - 1][0] : 0;

  return {
    cols: header.term.cols === 0 ? DEFAULT_COLS : header.term.cols,
    rows: header.term.rows === 0 ? DEFAULT_ROWS : header.term.rows,
    theme: parseTheme(header.term?.theme),
    events,
    duration,
    idleTimeLimit: header.idle_time_limit,
  };
}

function parseTheme(
  theme?: { fg?: string; bg?: string; palette?: string },
): ParsedTheme | undefined {
  if (!theme) return undefined;

  const fg = theme.fg;
  const bg = theme.bg;
  const palette = typeof theme.palette === "string"
    ? theme.palette.split(":")
    : undefined;

  if (!fg || !bg || !palette || palette.length < 8) return undefined;

  const normalizedPalette = [...palette];
  while (normalizedPalette.length < 16) {
    normalizedPalette.push(normalizedPalette[normalizedPalette.length - 8]);
  }

  return {
    foreground: fg,
    background: bg,
    palette: normalizedPalette.slice(0, 16),
  };
}
