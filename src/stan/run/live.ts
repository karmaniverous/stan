/* src/stan/run/live.ts
 * Scaffolding for TTY live progress rendering and process supervision.
 * Wiring is deferred; non‑TTY and --no-live runs are unaffected.
 */
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

export class ProgressRenderer {
  private readonly rows = new Map<string, ScriptState>();
  private readonly opts: {
    boring: boolean;
    refreshMs: number;
  };
  private timer?: NodeJS.Timeout;

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
  }

  update(scriptKey: string, state: ScriptState): void {
    this.rows.set(scriptKey, state);
  }

  private render(final = false): void {
    // Placeholder: no output yet to avoid changing current logs.
    // Future: use log-update + table for TTY-only live table.
    if (final) {
      // no-op
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

  // Track a spawned child (placeholder)
  track(_key: string, _pid: number): void {
    // no-op for now
  }

  // Graceful cancellation: TERM all tracked children (placeholder)
  async cancelAll(): Promise<void> {
    // no-op for now
  }
}
