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

type RowMeta = { type: 'script' | 'archive'; item: string };
type Row = RowMeta & { state: InternalState };

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
  private readonly rows = new Map<string, Row>();
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

  /** Render one final frame (no stop/persist). */
  public flush(): void {
    this.render();
  }
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.render(), this.opts.refreshMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    // Persist the most recently rendered frame; avoid a final re-render
    try {
      // Type-safe optional call; some builds expose logUpdate.done()
      const lu = logUpdate as unknown as { done?: () => void };
      lu.done?.();
    } catch {
      // best-effort
    }
  }

  /**
   * Update a row by stable key. Optional meta lets callers register type/item explicitly.
   * Keys:
   *  - scripts:  "script:<name>"
   *  - archives: "archive:full", "archive:diff"
   */
  update(key: string, state: ScriptState, meta?: RowMeta): void {
    const prior = this.rows.get(key);
    const resolvedMeta =
      meta ??
      this.deriveMetaFromKey(key) ??
      (prior?.type
        ? ({ type: prior.type, item: prior.item } as RowMeta)
        : undefined);
    if (!resolvedMeta) {
      // Fallback: infer as a script with the whole key as item.
      const fallback: RowMeta = { type: 'script', item: key };
      this.rows.set(key, {
        ...fallback,
        state: { ...(prior?.state ?? {}), ...state },
      });
      return;
    }
    this.rows.set(key, {
      ...resolvedMeta,
      state: { ...(prior?.state ?? {}), ...state },
    });
  }

  private deriveMetaFromKey(key: string): RowMeta | undefined {
    if (key.startsWith('script:')) {
      return {
        type: 'script',
        item: key.slice('script:'.length) || '(unnamed)',
      };
    }
    if (key.startsWith('archive:')) {
      return {
        type: 'archive',
        item: key.slice('archive:'.length) || '(unnamed)',
      };
    }
    return undefined;
  }

  private statusLabel(st: InternalState): string {
    const boring = this.opts.boring;
    switch (st.kind) {
      case 'waiting':
        return boring ? '[WAIT]' : yellow('… wait');
      case 'running': {
        return boring ? '[RUN]' : yellow('▶ run');
      }
      case 'quiet': {
        return boring ? '[QUIET]' : yellow('△ quiet');
      }
      case 'stalled': {
        return boring ? '[STALLED]' : yellow('△ stalled');
      }
      case 'done': {
        return boring ? '[OK]' : green('✔ ok');
      }
      case 'error': {
        return boring ? '[FAIL]' : red('✖ fail');
      }
      case 'timedout': {
        return boring ? '[TIMEOUT]' : red('⏱ timeout');
      }
      case 'cancelled': {
        return boring ? '[CANCELLED]' : yellow('◼ cancelled');
      }
      case 'killed': {
        return boring ? '[KILLED]' : red('◼ killed');
      }
      default:
        return '';
    }
  }

  private render(): void {
    const header = ['Type', 'Item', 'Status', 'Time', 'Output'];

    const rows: string[][] = [];
    rows.push(header);

    if (this.rows.size === 0) {
      // Minimal but visible placeholder
      const elapsed = fmtMs(now() - this.startedAt);
      rows.push([
        gray('—'),
        gray('—'),
        gray(this.opts.boring ? '[IDLE]' : 'idle'),
        gray(elapsed),
        gray(''),
      ]);
    } else {
      // Build a stable, grouped view: scripts first, then archives (regardless of registration timing).
      const all = Array.from(this.rows.values());
      const grouped = [
        ...all.filter((r) => r.type === 'script'),
        ...all.filter((r) => r.type === 'archive'),
      ];
      for (const row of grouped) {
        const st = row.state;
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

        rows.push([row.type, row.item, this.statusLabel(st), time, out ?? '']);
      }
    }

    const bodyTable = table(rows, {
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
      // No blank separators between rows
      drawHorizontalLine: () => false,
      columns: {
        // Status left; Time right-align; Output grows naturally
        2: { alignment: 'left' },
        3: { alignment: 'right' },
      },
    });

    // Summary + hint
    const elapsed = fmtMs(now() - this.startedAt);
    const counts = this.counts();
    const sep = ' • ';
    const summary = this.opts.boring
      ? `[${elapsed}]${sep}waiting ${counts.waiting}${sep}OK ${counts.ok}${sep}FAIL ${counts.fail}${sep}TIMEOUT ${counts.timeout}`
      : [
          `${elapsed}`,
          // waiting (yellow)
          yellow(`⏳ ${counts.waiting.toString()}`),
          // ok (green)
          green(`✔ ${counts.ok.toString()}`),
          // fail (red)
          red(`✖ ${counts.fail.toString()}`),
          // timeout (red)
          red(`⏱ ${counts.timeout.toString()}`),
        ].join(sep);
    const hint = this.opts.boring
      ? 'Press q to cancel'
      : gray('Press q to cancel');

    const body = `${bodyTable.trimEnd()}\n\n${summary}\n${hint}`;
    try {
      logUpdate(body);
    } catch {
      // best-effort; never throw from renderer
    }
  }

  private counts(): {
    waiting: number;
    ok: number;
    fail: number;
    timeout: number;
  } {
    let waiting = 0;
    let ok = 0;
    let fail = 0;
    let timeout = 0;
    for (const [, row] of this.rows.entries()) {
      const st = row.state;
      switch (st.kind) {
        case 'waiting':
          waiting += 1;
          break;
        case 'done':
          ok += 1;
          break;
        case 'timedout':
          timeout += 1;
          break;
        case 'error':
        case 'cancelled':
        case 'killed':
          fail += 1;
          break;
        default:
          // running/quiet/stalled are not counted in summary buckets
          break;
      }
    }
    return { waiting, ok, fail, timeout };
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
