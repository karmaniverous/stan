/* src/stan/run/ui.ts
 * Runner UI ports and adapters:
 * - LoggerUI: legacy console logs (no-live).
 * - LiveUI: ProgressRenderer + TTY key handling (live).
 */
import { relative } from 'node:path';

import { blue, green, red } from '@/stan/util/color';

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
  onCancelled(): void;
  installCancellation(triggerCancel: () => void): void;
  stop(): void;
};

export class LoggerUI implements RunnerUI {
  private restoreCancel: (() => void) | null = null;
  start(): void {
    // no-op
  }
  onPlan(planBody: string): void {
    console.log(planBody);
  }
  onScriptQueued(): void {
    // no-op (logger UI does not render waiting rows)
  }
  onScriptStart(key: string): void {
    console.log(`stan: ${blue('start')} "${key}"`);
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
    const done = exitCode && exitCode !== 0 ? red('done') : green('done');
    const tail = exitCode && exitCode !== 0 ? ` (exit ${exitCode})` : '';
    console.log(`stan: ${done} "${key}" -> ${rel}${tail}`);
  }
  onArchiveQueued(): void {
    // no-op (logger UI does not render waiting rows)
  }
  onArchiveStart(kind: ArchiveKind): void {
    const label = kind === 'full' ? 'archive' : 'archive (diff)';
    console.log(`stan: ${blue('start')} "${label}"`);
  }
  onArchiveEnd(kind: ArchiveKind, outAbs: string, cwd: string): void {
    const rel = relative(cwd, outAbs).replace(/\\/g, '/');
    const label = kind === 'full' ? 'archive' : 'archive (diff)';
    console.log(`stan: ${green('done')} "${label}" -> ${rel}`);
  }
  onCancelled(): void {
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
  onCancelled(): void {
    try {
      (this.renderer as { cancelPending?: () => void })?.cancelPending?.();
    } catch {
      /* ignore */
    }
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
  installCancellation(triggerCancel: () => void): void {
    try {
      const sub = installCancelKeys(triggerCancel);
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
