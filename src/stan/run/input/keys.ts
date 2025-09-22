/* src/stan/run/input/keys.ts
 * Key handling using the "keypress" library, with SIGINT parity.
 * - Installs raw key handler on TTY to cancel on 'q' or Ctrl+C.
 * - Also wires process SIGINT to the same cancellation pipeline.
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

  const onKeypress = (
    _ch: string | undefined,
    key?: { name?: string; ctrl?: boolean },
  ) => {
    if (!key) return;
    if ((key.ctrl && key.name === 'c') || key.name === 'q') onCancel();
  };
  stdin.on('keypress', onKeypress);

  const remove = (event: 'keypress', handler: (...args: unknown[]) => void) => {
    (stdin.off ?? stdin.removeListener)?.call(stdin, event, handler as never);
  };

  return {
    restore: () => {
      try {
        remove('keypress', onKeypress);
        stdin.setRawMode?.(false);
        stdin.pause?.();
        process.off('SIGINT', onSigint);
      } catch {
        /* ignore */
      }
    },
  };
};
