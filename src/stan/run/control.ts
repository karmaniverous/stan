/* src/stan/run/control.ts
 * RunnerControl — centralizes live cancellation wiring.
 * - Builtins only: readline.emitKeypressEvents + setRawMode for TTY; SIGINT everywhere.
 * - Keys: 'q' → cancel, 'r' → restart (when onRestart provided).
 * - Includes a minimal 'data' fallback to satisfy tests that emit('data','q').
 * - Idempotent attach/detach; always restores raw mode and pauses stdin.
 */
import { emitKeypressEvents } from 'node:readline';

export type RunnerControlOptions = {
  onCancel: () => void;
  onRestart?: () => void;
  /** When true, wire SIGINT only (no raw mode or key handlers). */
  sigintOnly?: boolean;
};

export class RunnerControl {
  private readonly onCancel: () => void;
  private readonly onRestart?: () => void;
  private readonly sigintOnly: boolean;

  private attached = false;
  private keyHandler?: (
    chunk: unknown,
    key?: { name?: string; ctrl?: boolean },
  ) => void;
  private dataHandler?: (d: unknown) => void;
  private sigintHandler?: () => void;

  constructor(opts: RunnerControlOptions) {
    this.onCancel = opts.onCancel;
    this.onRestart = opts.onRestart;
    this.sigintOnly = Boolean(opts.sigintOnly);
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;

    // Always wire SIGINT parity.
    this.sigintHandler = () => this.onCancel();
    process.on('SIGINT', this.sigintHandler);

    if (this.sigintOnly) return;

    const stdin = process.stdin as unknown as NodeJS.ReadStream & {
      isTTY?: boolean;
      setRawMode?: (v: boolean) => void;
      resume?: () => void;
      pause?: () => void;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      off?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (
        event: string,
        handler: (...args: unknown[]) => void,
      ) => void;
    };
    const stdoutTTY = Boolean(
      (process.stdout as unknown as { isTTY?: boolean }).isTTY,
    );
    const stdinTTY = Boolean((stdin as { isTTY?: boolean }).isTTY);
    const isTTY = stdoutTTY && stdinTTY;
    if (!isTTY) return; // non‑TTY: SIGINT is sufficient

    // Enable keypress events and raw mode.
    try {
      emitKeypressEvents(stdin);
      stdin.setRawMode?.(true);
      stdin.resume?.();
    } catch {
      // best‑effort
    }

    this.keyHandler = (_chunk, keyMaybe) => {
      const key = keyMaybe ?? ({} as { name?: string; ctrl?: boolean });
      const name = (key.name ?? '').toLowerCase();
      if ((key.ctrl && name === 'c') || name === 'q') {
        this.onCancel();
        return;
      }
      if (name === 'r') this.onRestart?.();
    };

    // Minimal data fallback (compat with tests that emit 'data', 'q').
    this.dataHandler = (d: unknown) => {
      try {
        if (typeof d === 'string') {
          const s = d.toLowerCase();
          if (s === '\u0003' || s === 'q') this.onCancel();
          else if (s === 'r') this.onRestart?.();
          return;
        }
        if (Buffer.isBuffer(d)) {
          if (d.includes(0x03)) {
            this.onCancel();
            return;
          }
          const s = d.toString('utf8').toLowerCase();
          if (s === 'q') this.onCancel();
          else if (s === 'r') this.onRestart?.();
        }
      } catch {
        // best‑effort
      }
    };

    // Attach listeners
    stdin.on?.('keypress', this.keyHandler as (...args: unknown[]) => void);
    stdin.on?.('data', this.dataHandler as (...args: unknown[]) => void);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;

    try {
      if (this.sigintHandler) process.off('SIGINT', this.sigintHandler);
    } catch {
      /* ignore */
    }

    const stdin = process.stdin as unknown as NodeJS.ReadStream & {
      setRawMode?: (v: boolean) => void;
      pause?: () => void;
      off?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (
        event: string,
        handler: (...args: unknown[]) => void,
      ) => void;
    };
    const remove =
      (stdin.off?.bind(stdin) as
        | ((e: string, h: (...args: unknown[]) => void) => void)
        | undefined) ??
      (stdin.removeListener?.bind(stdin) as
        | ((e: string, h: (...args: unknown[]) => void) => void)
        | undefined);

    try {
      if (remove && this.keyHandler) {
        remove(
          'keypress',
          this.keyHandler as unknown as (...args: unknown[]) => void,
        );
      }
      if (remove && this.dataHandler) {
        remove(
          'data',
          this.dataHandler as unknown as (...args: unknown[]) => void,
        );
      }
    } catch {
      /* ignore */
    }

    try {
      stdin.setRawMode?.(false);
      stdin.pause?.();
    } catch {
      /* ignore */
    }
  }
}
