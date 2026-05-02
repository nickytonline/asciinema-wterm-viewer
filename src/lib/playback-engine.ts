/**
 * Playback engine for asciicast recordings.
 * Handles timing, seeking, speed control, and event dispatching.
 */

import type { AsciicastEvent, ParsedRecording } from "./asciicast-parser";

export type PlaybackState = "idle" | "playing" | "paused" | "ended";

export interface PlaybackEventMap {
  stateChange: PlaybackState;
  timeUpdate: number;
  output: string | string[];
  resize: { cols: number; rows: number };
  marker: { time: number; label: string };
  reset: void;
}

type PlaybackEventHandler<K extends keyof PlaybackEventMap> = (
  data: PlaybackEventMap[K],
) => void;

export interface Marker {
  time: number;
  label: string;
}

export class PlaybackEngine {
  private recording: ParsedRecording;
  private events: AsciicastEvent[];
  private _state: PlaybackState = "idle";
  private _speed = 1;
  private _idleTimeLimit: number | undefined;
  private _loop = false;

  private startTime = 0;
  private pauseElapsedTime = 0;
  private nextEventIndex = 0;
  private lastEventTime = 0;
  private eventTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private playCount = 0;

  private outputBatchWindow = 1 / 60; // ~16ms batching

  private handlers = new Map<string, Set<Function>>();

  readonly cols: number;
  readonly rows: number;
  readonly duration: number;
  readonly markers: Marker[];

  constructor(recording: ParsedRecording) {
    this.recording = recording;
    this.events = recording.events;
    this.cols = recording.cols;
    this.rows = recording.rows;
    this.duration = recording.duration;
    this._idleTimeLimit = recording.idleTimeLimit;

    this.markers = this.events
      .filter((e) => e[1] === "m")
      .map((e) => {
        const data = typeof e[2] === "string" ? { label: e[2] } : JSON.parse(e[2]);
        return { time: e[0], label: data.label ?? "" };
      });

    if (this._idleTimeLimit !== undefined) {
      this.events = this.applyIdleTimeLimit(this.events, this._idleTimeLimit);
    }
  }

  get state(): PlaybackState {
    return this._state;
  }

  get speed(): number {
    return this._speed;
  }

  set speed(value: number) {
    const wasPlaying = this._state === "playing";

    if (wasPlaying) {
      this.pauseElapsedTime = this.now() - this.startTime;
      this.cancelNextEvent();
    }

    this._speed = Math.max(0.25, Math.min(16, value));

    if (wasPlaying) {
      this.startTime = this.now() - this.pauseElapsedTime;
      this.scheduleNextEvent();
    }
  }

  get loop(): boolean {
    return this._loop;
  }

  set loop(value: boolean) {
    this._loop = value;
  }

  get currentTime(): number {
    if (this.eventTimeoutId !== null) {
      return (this.now() - this.startTime) / 1000;
    }
    return this.pauseElapsedTime / 1000;
  }

  get progress(): number {
    if (this.duration === 0) return 0;
    return Math.min(this.currentTime, this.duration) / this.duration;
  }

  on<K extends keyof PlaybackEventMap>(
    event: K,
    handler: PlaybackEventHandler<K>,
  ): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  private emit<K extends keyof PlaybackEventMap>(
    event: K,
    data: PlaybackEventMap[K],
  ) {
    const set = this.handlers.get(event);
    if (set) {
      for (const handler of set) {
        (handler as PlaybackEventHandler<K>)(data);
      }
    }
  }

  play(): boolean {
    if (this._state === "playing") return true;

    if (this._state === "ended" || this.events[this.nextEventIndex] === undefined) {
      this.rewind();
    }

    this.setState("playing");
    this.resume();

    return true;
  }

  pause(): boolean {
    if (this._state !== "playing") return false;

    this.doPause();
    this.setState("paused");

    return true;
  }

  togglePlay(): void {
    if (this._state === "playing") {
      this.pause();
    } else {
      this.play();
    }
  }

  seek(time: number): boolean {
    const targetTime = Math.min(Math.max(time, 0), this.duration);
    const wasPlaying = this._state === "playing";

    if (wasPlaying) {
      this.doPause();
    }

    if (targetTime < this.lastEventTime) {
      this.emit("reset", undefined);
      this.emit("resize", { cols: this.cols, rows: this.rows });
      this.nextEventIndex = 0;
      this.lastEventTime = 0;
    }

    const output: string[] = [];
    let event = this.events[this.nextEventIndex];

    while (event && event[0] <= targetTime) {
      if (event[1] === "o") {
        output.push(event[2]);
      } else if (event[1] === "r") {
        if (output.length > 0) {
          this.emit("output", output.splice(0));
        }
        const [cols, rows] = event[2].split("x").map((n) => parseInt(n, 10));
        this.emit("resize", { cols, rows });
      }

      this.lastEventTime = event[0];
      event = this.events[++this.nextEventIndex];
    }

    if (output.length > 0) {
      this.emit("output", output);
    }

    this.pauseElapsedTime = targetTime * 1000;

    if (wasPlaying) {
      this.setState("playing");
      this.resume();
    } else if (this._state !== "ended") {
      this.setState("paused");
    }

    this.emit("timeUpdate", this.currentTime);
    return true;
  }

  seekRelative(delta: number): boolean {
    return this.seek(this.currentTime + delta);
  }

  seekPercent(percent: number): boolean {
    return this.seek((percent / 100) * this.duration);
  }

  seekToMarker(direction: "prev" | "next"): boolean {
    const ct = this.currentTime;

    if (direction === "prev") {
      for (let i = this.markers.length - 1; i >= 0; i--) {
        if (this.markers[i].time < ct - 1) {
          return this.seek(this.markers[i].time);
        }
      }
      return this.seek(0);
    } else {
      for (const m of this.markers) {
        if (m.time > ct) {
          return this.seek(m.time);
        }
      }
      return this.seek(this.duration);
    }
  }

  step(n = 1): boolean {
    if (this._state === "playing") return false;

    if (this._state === "idle" || this._state === "ended") {
      this.rewind();
    }

    let targetIndex: number | undefined;

    if (n > 0) {
      let index = this.nextEventIndex;
      let event = this.events[index];

      for (let i = 0; i < n; i++) {
        while (event !== undefined && event[1] !== "o") {
          event = this.events[++index];
        }
        if (event !== undefined && event[1] === "o") {
          targetIndex = index;
          event = this.events[++index];
        }
      }
    } else {
      let index = Math.max(this.nextEventIndex - 2, 0);
      let event = this.events[index];

      for (let i = n; i < 0; i++) {
        while (event !== undefined && event[1] !== "o") {
          event = this.events[--index];
        }
        if (event !== undefined && event[1] === "o") {
          targetIndex = index;
          event = this.events[--index];
        }
      }

      if (targetIndex !== undefined) {
        this.emit("reset", undefined);
        this.emit("resize", { cols: this.cols, rows: this.rows });
        this.nextEventIndex = 0;
      }
    }

    if (targetIndex === undefined) return false;

    const output: string[] = [];

    while (this.nextEventIndex <= targetIndex) {
      const event = this.events[this.nextEventIndex++];
      if (event[1] === "o") {
        output.push(event[2]);
      } else if (event[1] === "r") {
        if (output.length > 0) {
          this.emit("output", output.splice(0));
        }
        const [cols, rows] = event[2].split("x").map((n2) => parseInt(n2, 10));
        this.emit("resize", { cols, rows });
      }
    }

    if (output.length > 0) {
      this.emit("output", output);
    }

    const lastEvent = this.events[targetIndex];
    this.lastEventTime = lastEvent[0];
    this.pauseElapsedTime = this.lastEventTime * 1000;
    this.emit("timeUpdate", this.currentTime);

    return true;
  }

  stop(): void {
    this.cancelNextEvent();
    this.setState("idle");
    this.nextEventIndex = 0;
    this.lastEventTime = 0;
    this.pauseElapsedTime = 0;
    this.playCount = 0;
  }

  destroy(): void {
    this.stop();
    this.handlers.clear();
  }

  // -- poster support: render all output up to a given time without playing --
  renderPosterAt(time: number): void {
    this.emit("reset", undefined);
    this.emit("resize", { cols: this.cols, rows: this.rows });

    const output: string[] = [];
    for (const event of this.events) {
      if (event[0] > time) break;
      if (event[1] === "o") {
        output.push(event[2]);
      } else if (event[1] === "r") {
        if (output.length > 0) {
          this.emit("output", output.splice(0));
        }
        const [cols, rows] = event[2].split("x").map((n) => parseInt(n, 10));
        this.emit("resize", { cols, rows });
      }
    }
    if (output.length > 0) {
      this.emit("output", output);
    }
  }

  private setState(state: PlaybackState) {
    this._state = state;
    this.emit("stateChange", state);
  }

  private now(): number {
    return performance.now() * this._speed;
  }

  private resume() {
    this.startTime = this.now() - this.pauseElapsedTime;
    this.scheduleNextEvent();
  }

  private doPause() {
    this.cancelNextEvent();
    this.pauseElapsedTime = this.now() - this.startTime;
  }

  private rewind() {
    this.emit("reset", undefined);
    this.emit("resize", { cols: this.cols, rows: this.rows });
    this.nextEventIndex = 0;
    this.lastEventTime = 0;
    this.pauseElapsedTime = 0;
  }

  private scheduleNextEvent() {
    const nextEvent = this.events[this.nextEventIndex];

    if (nextEvent) {
      let timeout =
        (nextEvent[0] * 1000 - (this.now() - this.startTime)) / this._speed;
      if (timeout < 0) timeout = 0;
      this.eventTimeoutId = setTimeout(() => this.runNextEvent(), timeout);
    } else {
      this.onEnd();
    }
  }

  private runNextEvent() {
    while (this.events[this.nextEventIndex] !== undefined) {
      this.executeNextEventChunk();

      const nextEvent = this.events[this.nextEventIndex];
      if (nextEvent === undefined) break;

      const elapsedWallTime = this.now() - this.startTime;
      if (elapsedWallTime <= nextEvent[0] * 1000) break;
    }

    this.scheduleNextEvent();
  }

  private executeNextEventChunk() {
    const event = this.events[this.nextEventIndex];

    if (event[1] === "o") {
      this.executeOutputGroup();
    } else {
      this.lastEventTime = event[0];
      this.nextEventIndex++;
      this.executeEvent(event);
    }
  }

  private executeOutputGroup() {
    const firstEvent = this.events[this.nextEventIndex];
    const batchDeadline = firstEvent[0] + this.outputBatchWindow;
    const output: string[] = [];
    let event = firstEvent;

    while (
      event !== undefined &&
      event[1] === "o" &&
      event[0] < batchDeadline
    ) {
      output.push(event[2]);
      this.lastEventTime = event[0];
      this.nextEventIndex++;
      event = this.events[this.nextEventIndex];
    }

    this.emit("output", output);
  }

  private executeEvent(event: AsciicastEvent) {
    const [time, type, data] = event;

    if (type === "o") {
      this.emit("output", data);
    } else if (type === "r") {
      const [cols, rows] = data.split("x").map((n) => parseInt(n, 10));
      this.emit("resize", { cols, rows });
    } else if (type === "m") {
      const parsed = typeof data === "string" ? { label: data } : JSON.parse(data);
      this.emit("marker", { time, label: parsed.label ?? "" });
    }
  }

  private onEnd() {
    this.cancelNextEvent();
    this.playCount++;

    if (this._loop) {
      this.rewind();
      this.startTime = this.now();
      this.scheduleNextEvent();
    } else {
      this.pauseElapsedTime = this.duration * 1000;
      this.setState("ended");
      this.emit("timeUpdate", this.duration);
    }
  }

  private cancelNextEvent() {
    if (this.eventTimeoutId !== null) {
      clearTimeout(this.eventTimeoutId);
      this.eventTimeoutId = null;
    }
  }

  private applyIdleTimeLimit(
    events: AsciicastEvent[],
    limit: number,
  ): AsciicastEvent[] {
    if (events.length === 0) return events;

    const result: AsciicastEvent[] = [events[0]];
    let adjustment = 0;

    for (let i = 1; i < events.length; i++) {
      const gap = events[i][0] - events[i - 1][0];
      if (gap > limit) {
        adjustment += gap - limit;
      }
      result.push([events[i][0] - adjustment, events[i][1], events[i][2]]);
    }

    return result;
  }
}
