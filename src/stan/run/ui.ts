/* src/stan/run/ui.ts
 * Runner UI ports and adapters:
 * - LoggerUI: legacy console logs (no-live).
 * - LiveUI: ProgressRenderer + TTY key handling (live).
 */
import { relative } from 'node:path';

import { installCancelKeys } from './input/keys';
import { ProgressRenderer } from './live/renderer';

export type ArchiveKind = 'full' | 'diff';

export type RunnerUI = {
  start(): void;
  onPlan(planBody: string): void;
  onScriptStart(key: string): void;
  onScriptEnd(
    key: string,
    outAbs: string,
    cwd: string,
    startedAt: number,
    endedAt: number,
  ): void;
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
  onScriptStart(key: string): void {
    console.log(`stan: start "${key}"`);
  }
  onScriptEnd(key: string, outAbs: string, cwd: string): void {
    const rel = relative(cwd, outAbs).replace(/\\/g, '/');
    console.log(`stan: done "${key}" -> ${rel}`);
  }
  onArchiveStart(kind: ArchiveKind): void {
    console.log(
      `stan: start "${kind === 'full' ? 'archive' : 'archive (diff)'}"`,
    );
  }
  onArchiveEnd(kind: ArchiveKind, outAbs: string, cwd: string): void {
    const rel = relative(cwd, outAbs).replace(/\\/g, '/');
    console.log(
      `stan: done "${kind === 'full' ? 'archive' : 'archive (diff)'}" -> ${rel}`,
    );
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
    // Provide SIGINT parity even in no-live mode so cancellation semantics match.
    const onSigint = () => triggerCancel();
    try {
      process.on('SIGINT', onSigint);
      this.restoreCancel = () => {
        try {
          process.off('SIGINT', onSigint);
        } catch {
          /* ignore */
        }
      };
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
  ): void {
    const rel = relative(cwd, outAbs).replace(/\\/g, '/');
    this.renderer?.update(
      `script:${key}`,
      {
        kind: 'done',
        durationMs: Math.max(0, endedAt - startedAt),
        outputPath: rel,
      },
      { type: 'script', item: key },
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
