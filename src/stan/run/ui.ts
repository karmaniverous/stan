/* src/stan/run/ui.ts
 * Runner UI ports and adapters:
 * - LoggerUI: legacy console logs (no-live).
 * - LiveUI: ProgressRenderer + TTY key handling (live).
 */
import { relative } from 'node:path';

import { RunnerControl } from './control';
import { label } from './labels';
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

export class LoggerUI implements RunnerUI {
  start(): void {
    // no-op
  }
  onPlan(planBody: string): void {
    console.log(planBody);
  }
  onScriptQueued(key: string): void {
    // Surface a "waiting" status to mirror live table state.
    console.log(`stan: ${label('waiting')} "${key}"`);
  }
  onScriptStart(key: string): void {
    console.log(`stan: ${label('run')} "${key}"`);
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
    const lbl = ok ? label('ok') : label('error');
    const tail = ok ? '' : ` (exit ${exitCode})`;
    console.log(`stan: ${lbl} "${key}" -> ${rel}${tail}`);
  }
  onArchiveQueued(): void {
    // no-op (logger UI does not render waiting rows)
  }
  onArchiveStart(kind: ArchiveKind): void {
    const lbl = kind === 'full' ? 'archive' : 'archive (diff)';
    console.log(`stan: ${label('run')} "${lbl}"`);
  }
  onArchiveEnd(kind: ArchiveKind, outAbs: string, cwd: string): void {
    const rel = relative(cwd, outAbs).replace(/\\/g, '/');
    const lbl = kind === 'full' ? 'archive' : 'archive (diff)';
    console.log(`stan: ${label('ok')} "${lbl}" -> ${rel}`);
  }
  onCancelled(mode?: 'cancel' | 'restart'): void {
    void mode;
    // no-op (session handles SIGINT; no TTY keys in logger mode)
  }
  installCancellation(triggerCancel: () => void): void {
    // no-op: non-live mode relies on session-level SIGINT handling.
    void triggerCancel;
  }
  stop(): void {
    // no-op
  }
}

export class LiveUI implements RunnerUI {
  private renderer: ProgressRenderer | null = null;
  private control: RunnerControl | null = null;

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
      this.control?.detach();
    } catch {
      /* ignore */
    }
    this.control = null;
    // Drop the renderer so the next run starts from a clean slate.
    // (A fresh ProgressRenderer instance will be constructed by start().)
    this.renderer = null;
  }
  installCancellation(triggerCancel: () => void, onRestart?: () => void): void {
    try {
      this.control = new RunnerControl({ onCancel: triggerCancel, onRestart });
      this.control.attach();
    } catch {
      // best-effort
      this.control = null;
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
      this.control?.detach();
    } catch {
      /* ignore */
    }
    this.control = null;
  }
}
