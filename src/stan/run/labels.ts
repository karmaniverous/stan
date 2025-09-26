/* src/stan/run/labels.ts
 * Shared BORING/TTY-aware status label helper for Logger and Live UIs.
 */
import {
  black,
  blue,
  cyan,
  gray,
  green,
  magenta,
  red,
} from '@/stan/util/color';

export type StatusKind =
  | 'waiting'
  | 'run'
  | 'ok'
  | 'error'
  | 'cancelled'
  | 'timeout'
  | 'quiet'
  | 'stalled'
  | 'killed';

// BORING detection mirrors other UI helpers so Live/Logger remain consistent.
const isTTY = Boolean(
  (process.stdout as unknown as { isTTY?: boolean })?.isTTY,
);
const isBoring = (): boolean =>
  process.env.STAN_BORING === '1' ||
  process.env.NO_COLOR === '1' ||
  process.env.FORCE_COLOR === '0' ||
  !isTTY;

/**
 * Render a status label suitable for table/log rows.
 * Honors BORING/TTY via util/color.
 */
export const label = (kind: StatusKind): string => {
  if (isBoring()) {
    // Bracketed tokens for BORING/non‑TTY to match Logger parity and tests.
    switch (kind) {
      case 'waiting':
        return '[WAIT]';
      case 'run':
        return '[RUN]';
      case 'ok':
        return '[OK]';
      case 'error':
        return '[FAIL]';
      case 'cancelled':
        return '[CANCELLED]';
      case 'timeout':
        return '[TIMEOUT]';
      case 'quiet':
        return '[QUIET]';
      case 'stalled':
        return '[STALLED]';
      case 'killed':
        return '[KILLED]';
      default:
        return '';
    }
  }
  switch (kind) {
    case 'waiting':
      return gray('⏸ waiting');
    case 'run':
      return blue('▶ run');
    case 'ok':
      return green('✔ ok');
    case 'error':
      return red('✖ fail');
    case 'cancelled':
      return black('◼ cancelled');
    case 'timeout':
      return red('⏱ timeout');
    case 'quiet':
      return cyan('⏱ quiet');
    case 'stalled':
      return magenta('⏱ stalled');
    case 'killed':
      return red('◼ killed');
    default:
      return '';
  }
};
