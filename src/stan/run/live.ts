/* src/stan/run/live.ts
 * TTY live progress rendering and (future) process supervision.
 * - ProgressRenderer: log-update + table to render a live table every ~1s.
 * - BORING mode: drops color/emojis but keeps the table visible.
 * - Non‑TTY and --no-live runs remain unchanged (renderer never started).
 */
import logUpdate from 'log-update';
import { table } from 'table';

import { gray, green, red, yellow } from '@/stan/util/color';

import type { RunBehavior } from './types';

export type ScriptState =
  | { kind: 'waiting' }
  | { kind: 'running'; startedAt: number; lastOutputAt?: number }
  | {
      kind: 'quiet';
      startedAt: number;
      lastOutputAt?: number;
      quietFor: number;
    }
  | {
      kind: 'stalled';
      startedAt: number;
      lastOutputAt: number;
      stalledFor: number;
    }
  | { kind: 'done'; durationMs: number; outputPath?: string }
  | { kind: 'error'; durationMs: number; outputPath?: string }
  | { kind: 'timedout'; durationMs: number; outputPath?: string }
  | { kind: 'cancelled'; durationMs?: number }
  | { kind: 'killed'; durationMs?: number };

type InternalState = ScriptState & { outputPath?: string };

const now = (): number => Date.now();
const pad2 = (n: number): string => n.toString().padStart(2, '0');
const fmtMs = (ms: number): string => {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${pad2(mm)}:${pad2(ss)}`;
};

export class ProgressRenderer {
  private readonly rows = new Map<string, InternalState>();
  private readonly opts: {
    boring: boolean;
    refreshMs: number;
  };
  private timer?: NodeJS.Timeout;
  private readonly startedAt = now();

  constructor(args?: { boring?: boolean; refreshMs?: number }) {
    this.opts = {
      boring: Boolean(args?.boring),
      refreshMs: args?.refreshMs ?? 1000,
    };
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.render(), this.opts.refreshMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.render(true);
    // Persist last frame on screen for a moment
    try {
      // @ts-expect-error types for log-update expose .done()
      logUpdate.done && logUpdate.done();
    } catch {
      // best-effort
    }
  }

  update(scriptKey: string, state: ScriptState): void {
    // Preserve any optional outputPath the caller supplied
    const prior = this.rows.get(scriptKey);
    const merged: InternalState = { ...(prior ?? {}), ...state };
    this.rows.set(scriptKey, merged);
  }

  private statusLabel(st: InternalState): string {
    const boring = this.opts.boring;
    const icon = (s: string) => (boring ? s : s);
    switch (st.kind) {
      case 'waiting':
        return boring ? '[WAIT]' : yellow('⏳ wait');
      case 'running': {
        const elapsed = fmtMs(now() - st.startedAt);
        return boring ? `[RUN] ${elapsed}` : yellow(`▶ ${elapsed}`);
      }
      case 'quiet': {
        const elapsed = fmtMs(now() - st.startedAt);
        const q = fmtMs(st.quietFor * 1000);
        return boring
          ? `[RUN quiet ${q}] ${elapsed}`
          : yellow(`△ ${elapsed} quiet ${q}`);
      }
      case 'stalled': {
        const elapsed = fmtMs(now() - st.startedAt);
        const q = fmtMs(st.stalledFor * 1000);
        return boring
          ? `[RUN stalled ${q}] ${elapsed}`
          : yellow(`△ ${elapsed} stalled ${q}`);
      }
      case 'done': {
        const t = fmtMs(st.durationMs);
        return boring ? `[OK] ${t}` : green(`✔ ${t}`);
      }
      case 'error': {
        const t = fmtMs(st.durationMs);
        return boring ? `[FAIL] ${t}` : red(`✖ ${t}`);
      }
      case 'timedout': {
        const t = fmtMs(st.durationMs);
        return boring ? `[TIMEOUT] ${t}` : red(`⏱ ${t}`);
      }
      case 'cancelled': {
        const t = st.durationMs ? fmtMs(st.durationMs) : '';
        return boring ? `[CANCELLED] ${t}` : yellow(`◼ ${t}`);
      }
      case 'killed': {
        const t = st.durationMs ? fmtMs(st.durationMs) : '';
        return boring ? `[KILLED] ${t}` : red(`◼ ${t}`);
      }
      default:
        return '';
    }
  }

  private render(final = false): void {
    const header = ['Script', 'Status', 'Time', 'Output'];

    const rows: string[][] = [];
    rows.push(header);

    if (this.rows.size === 0) {
      // Minimal but visible placeholder
      const elapsed = fmtMs(now() - this.startedAt);
      rows.push([
        gray('—'),
        gray(this.opts.boring ? `[IDLE] ${elapsed}` : `idle ${elapsed}`),
        gray(elapsed),
        gray(''),
      ]);
    } else {
      for (const [key, st] of this.rows.entries()) {
        // Time column: elapsed (running) or duration/blank
        let time = '';
        if (
          st.kind === 'running' ||
          st.kind === 'quiet' ||
          st.kind === 'stalled'
        ) {
          time = fmtMs(now() - st.startedAt);
        } else if (
          'durationMs' in st &&
          typeof (st as { durationMs?: number }).durationMs === 'number'
        ) {
          time = fmtMs((st as { durationMs: number }).durationMs);
        } else {
          time = '';
        }

        const out =
          st.kind === 'done' ||
          st.kind === 'error' ||
          st.kind === 'timedout' ||
          st.kind === 'cancelled' ||
          st.kind === 'killed'
            ? (st.outputPath ?? '')
            : '';

        rows.push([key, this.statusLabel(st), time, out ?? '']);
      }
    }

    const body = table(rows, {
      // Keep it compact and stable; avoid ANSI-heavy borders that flicker
      border: {
        topBody: ``,
        topJoin: ``,
        topLeft: ``,
        topRight: ``,
        bottomBody: ``,
        bottomJoin: ``,
        bottomLeft: ``,
        bottomRight: ``,
        bodyLeft: ``,
        bodyRight: ``,
        bodyJoin: ``,
        joinBody: ``,
        joinLeft: ``,
        joinRight: ``,
        joinJoin: ``,
      },
      drawHorizontalLine: () => true,
      columns: {
        // Make Status a bit wider to fit icons/timers; Output grows naturally
        1: { alignment: 'left' },
        2: { alignment: 'right' },
      },
    });

    try {
      logUpdate(body);
      if (final) {
        // Leave the last frame rendered; avoid clearing on completion
        // (logUpdate.done is handled in stop()).
      }
    } catch {
      // best-effort; never throw from renderer
    }
  }
}

export class ProcessSupervisor {
  constructor(
    private readonly behavior: Pick<
      RunBehavior,
      'hangWarn' | 'hangKill' | 'hangKillGrace'
    >,
  ) {}

  // Minimal scaffolding to establish a future control surface.
  private readonly pids = new Map<string, number>();

  // Track a spawned child (placeholder; no signaling yet)
  track(key: string, pid: number): void {
    this.pids.set(key, pid);
  }

  // Graceful cancellation: TERM all tracked children (placeholder)
  // Synchronous for now to satisfy lint (no awaits yet).
  cancelAll(): void {
    // Future: send SIGTERM and, after grace, SIGKILL (tree-kill on Windows).
    for (const [k, pid] of this.pids) {
      void k;
      void pid;
    }
    this.pids.clear();
  }
}
