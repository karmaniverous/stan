/* src/stan/run/ui.ts
 * Runner UI ports and adapters:
 * - LoggerUI: legacy console logs (no-live).
 * - LiveUI: ProgressRenderer + TTY key handling (live).
 */
import { relative } from 'node:path';

import {
  black,
  blue,
  cyan,
  gray,
  green,
  magenta,
  red,
} from '@/stan/util/color';

import { installCancelKeys } from './input/keys';
import { ProgressRenderer } from './live/renderer';
export type ArchiveKind = 'full' | 'diff';

export type RunnerUI = {
  start(): void;
  onPlan(planBody: string): void;
  onScriptQueued(key: string): void;
  onScriptStart(key: string): void;
  onScriptEnd(
    key: string,
    outAbs: string,
    cwd: string,
    startedAt: number,
    endedAt: number,
    exitCode?: number,
  ): void;
  onArchiveQueued(kind: ArchiveKind): void;
  onArchiveStart(kind: ArchiveKind): void;
  onArchiveEnd(
    kind: ArchiveKind,
    outAbs: string,
    cwd: string,
    startedAt: number,
    endedAt: number,
  ): void;
  onCancelled(mode?: 'cancel' | 'restart'): void;
  installCancellation(triggerCancel: () => void, onRestart?: () => void): void;
  stop(): void;
};
// BORING/TTY-aware status label helper mirroring the live renderer.
const isTTY = Boolean(
  (process.stdout as unknown as { isTTY?: boolean })?.isTTY,
);
const isBoring = (): boolean =>
  process.env.STAN_BORING === '1' ||
  process.env.NO_COLOR === '1' ||
  process.env.FORCE_COLOR === '0' ||
  !isTTY;

type StatusKind =
  | 'waiting'
  | 'run'
  | 'ok'
  | 'error'
  | 'cancelled'
  | 'timeout'
  | 'quiet'
  | 'stalled'
  | 'killed';

const statusLabel = (kind: StatusKind): string => {
  const boring = isBoring();
  switch (kind) {
    case 'waiting':
      return boring ? '[WAIT]' : gray('⏸ waiting');
    case 'run':
      return boring ? '[RUN]' : blue('▶ run');
    case 'ok':
      return boring ? '[OK]' : green('✔ ok');
    case 'error':
      return boring ? '[FAIL]' : red('✖ fail');
    case 'cancelled':
      return boring ? '[CANCELLED]' : black('◼ cancelled');
    case 'timeout':
      return boring ? '[TIMEOUT]' : red('⏱ timeout');
    case 'quiet':
      return boring ? '[QUIET]' : cyan('⏱ quiet');
    case 'stalled':
      return boring ? '[STALLED]' : magenta('⏱ stalled');
    case 'killed':
      return boring ? '[KILLED]' : red('◼ killed');
    default:
      return '';
  }
};

export class LoggerUI implements RunnerUI {
  private restoreCancel: (() => void) | null = null;
  start(): void {
    // no-op
  }
  onPlan(planBody: string): void {
    console.log(planBody);
  }
  onScriptQueued(key: string): void {
    // Surface a "waiting" status to mirror live table state.
    console.log(`stan: ${statusLabel('waiting')} "${key}"`);
  }
  onScriptStart(key: string): void {
    console.log(`stan: ${statusLabel('run')} "${key}"`);
  }
  onScriptEnd(
    key: string,
    outAbs: string,
    cwd: string,
    _startedAt: number,
    _endedAt: number,
    exitCode?: number,
  ): void {
    const rel = relative(cwd, outAbs).replace(/\\/g, '/');
    const ok = typeof exitCode !== 'number' || exitCode === 0;
    const label = ok ? statusLabel('ok') : statusLabel('error');
    const tail = ok ? '' : ` (exit ${exitCode})`;
    console.log(`stan: ${label} "${key}" -> ${rel}${tail}`);
  }
  onArchiveQueued(): void {
    // no-op (logger UI does not render waiting rows)
  }
  onArchiveStart(kind: ArchiveKind): void {
    const label = kind === 'full' ? 'archive' : 'archive (diff)';
    console.log(`stan: ${statusLabel('run')} "${label}"`);
  }
  onArchiveEnd(kind: ArchiveKind, outAbs: string, cwd: string): void {
    const rel = relative(cwd, outAbs).replace(/\\/g, '/');
    const label = kind === 'full' ? 'archive' : 'archive (diff)';
    console.log(`stan: ${statusLabel('ok')} "${label}" -> ${rel}`);
  }
  onCancelled(mode?: 'cancel' | 'restart'): void {
    void mode;
    try {
      this.restoreCancel?.();
    } catch {
      /* ignore */
    }
    this.restoreCancel = null;
  }
  installCancellation(triggerCancel: () => void): void {
    // Reuse unified cancel keys wiring, but restrict to SIGINT only (no TTY raw key handlers).
    try {
      const sub = installCancelKeys(triggerCancel, { sigintOnly: true });
      this.restoreCancel = sub.restore;
    } catch {
      this.restoreCancel = null;
    }
  }
  stop(): void {
    try {
      this.restoreCancel?.();
    } catch {
      /* ignore */
    }
    this.restoreCancel = null;
  }
}

export class LiveUI implements RunnerUI {
  private renderer: ProgressRenderer | null = null;
  private restoreCancel: (() => void) | null = null;

  constructor(private readonly opts?: { boring?: boolean }) {}

  start(): void {
    if (!this.renderer) {
      this.renderer = new ProgressRenderer({
        boring: Boolean(this.opts?.boring),
      });
      this.renderer.start();
    }
  }
  onPlan(planBody: string): void {
    console.log(planBody);
  }
  onScriptQueued(key: string): void {
    // Pre-register a script row in "waiting" state so it appears at run start.
    this.renderer?.update(
      `script:${key}`,
      { kind: 'waiting' },
      { type: 'script', item: key },
    );
  }
  onScriptStart(key: string): void {
    this.renderer?.update(
      `script:${key}`,
      { kind: 'running', startedAt: Date.now() },
      { type: 'script', item: key },
    );
  }
  onScriptEnd(
    key: string,
    outAbs: string,
    cwd: string,
    startedAt: number,
    endedAt: number,
    exitCode?: number,
  ): void {
    const rel = relative(cwd, outAbs).replace(/\\/g, '/');
    this.renderer?.update(
      `script:${key}`,
      exitCode && exitCode !== 0
        ? {
            kind: 'error',
            durationMs: Math.max(0, endedAt - startedAt),
            outputPath: rel,
          }
        : {
            kind: 'done',
            durationMs: Math.max(0, endedAt - startedAt),
            outputPath: rel,
          },
      { type: 'script', item: key },
    );
  }
  onArchiveQueued(kind: ArchiveKind): void {
    const item = kind === 'full' ? 'full' : 'diff';
    this.renderer?.update(
      `archive:${item}`,
      { kind: 'waiting' },
      { type: 'archive', item },
    );
  }
  onArchiveStart(kind: ArchiveKind): void {
    const item = kind === 'full' ? 'full' : 'diff';
    this.renderer?.update(
      `archive:${item}`,
      { kind: 'running', startedAt: Date.now() },
      { type: 'archive', item },
    );
  }
  onArchiveEnd(
    kind: ArchiveKind,
    outAbs: string,
    cwd: string,
    startedAt: number,
    endedAt: number,
  ): void {
    const item = kind === 'full' ? 'full' : 'diff';
    const rel = relative(cwd, outAbs).replace(/\\/g, '/');
    this.renderer?.update(`archive:${item}`, {
      kind: 'done',
      durationMs: Math.max(0, endedAt - startedAt),
      outputPath: rel,
    });
  }
  /**
   * Tear down live rendering on cancellation.
   * - mode === 'cancel' (default): persist the final frame (do not clear).
   * - mode === 'restart': clear the frame so the next run reuses the same UI area.
   */
  onCancelled(mode: 'cancel' | 'restart' = 'cancel'): void {
    try {
      (this.renderer as { cancelPending?: () => void })?.cancelPending?.();
    } catch {
      /* ignore */
    }
    try {
      // For restart, do NOT flush a final frame (which can reprint the table).
      // Clear immediately to ensure the next run reuses the same UI area without duplication.
      if (mode === 'restart') {
        (this.renderer as unknown as { clear?: () => void })?.clear?.();
        this.renderer?.stop();
      } else {
        // cancel: persist final frame (log-update done via stop without clear)
        this.renderer?.stop();
      }
    } catch {
      /* ignore */
    }
    try {
      this.restoreCancel?.();
    } catch {
      /* ignore */
    }
    this.restoreCancel = null;
    // Drop the renderer so the next run starts from a clean slate.
    // (A fresh ProgressRenderer instance will be constructed by start().)
    this.renderer = null;
  }
  installCancellation(triggerCancel: () => void, onRestart?: () => void): void {
    try {
      const sub = installCancelKeys(triggerCancel, {
        onRestart,
      });
      this.restoreCancel = sub.restore;
    } catch {
      // best-effort
      this.restoreCancel = null;
    }
  }
  stop(): void {
    try {
      this.renderer?.flush();
      this.renderer?.stop();
    } catch {
      /* ignore */
    }
    try {
      this.restoreCancel?.();
    } catch {
      /* ignore */
    }
    this.restoreCancel = null;
  }
}
