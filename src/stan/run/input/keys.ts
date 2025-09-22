/* src/stan/run/input/keys.ts
 * Key handling using the "keypress" library, with SIGINT parity.
 * - Installs raw key handler on TTY to cancel on 'q' or Ctrl+C.
 * - Also wires process SIGINT to the same cancellation pipeline, with a data-event fallback.
 * - Returns a single restore() that removes all listeners and raw mode.
 */
import keypress from 'keypress';
export type CancelSubscription = {
  restore: () => void;
};

export const installCancelKeys = (onCancel: () => void): CancelSubscription => {
  const stdin = process.stdin as unknown as NodeJS.ReadStream & {
    setRawMode?: (v: boolean) => void;
    off?: (event: string, handler: (...args: unknown[]) => void) => void;
    removeListener?: (
      event: string,
      handler: (...args: unknown[]) => void,
    ) => void;
    pause?: () => void;
  };

  const isTTY =
    Boolean((process.stdout as unknown as { isTTY?: boolean })?.isTTY) &&
    Boolean((stdin as unknown as { isTTY?: boolean }).isTTY);

  // Always wire SIGINT parity
  const onSigint = () => onCancel();
  process.on('SIGINT', onSigint);

  if (!isTTY) {
    // Non‑TTY: only SIGINT is used; provide a minimal restore
    return {
      restore: () => {
        try {
          process.off('SIGINT', onSigint);
        } catch {
          /* ignore */
        }
      },
    };
  }

  // TTY: enable keypress and raw mode
  keypress(stdin);
  try {
    stdin.setRawMode?.(true);
  } catch {
    // best-effort
  }
  stdin.resume();

  const onKeypress = (...args: unknown[]): void => {
    const key = args[1] as { name?: string; ctrl?: boolean } | undefined;
    if (!key) return;
    if ((key.ctrl && key.name === 'c') || key.name === 'q') onCancel();
  };
  stdin.on('keypress', onKeypress);

  // Fallback: some test environments won’t provide setRawMode; ensure 'q' / Ctrl+C still cancel.
  const onData = (d: unknown): void => {
    try {
      // Ctrl+C (ETX) => 0x03
      if (typeof d === 'string') {
        if (d === '\u0003' || d.toLowerCase() === 'q') onCancel();
      } else if (Buffer.isBuffer(d)) {
        if (d.includes(0x03) || d.toString('utf8').toLowerCase() === 'q')
          onCancel();
      }
    } catch {
      // best-effort
    }
  };
  stdin.on('data', onData);

  const removeAny = (event: string, handler: (...args: unknown[]) => void) => {
    (stdin.off ?? stdin.removeListener)?.call(
      stdin,
      event as never,
      handler as never,
    );
  };

  return {
    restore: () => {
      try {
        removeAny('keypress', onKeypress);
        removeAny('data', onData);
        stdin.setRawMode?.(false);
        stdin.pause?.();
        process.off('SIGINT', onSigint);
      } catch {
        /* ignore */
      }
    },
  };
};
