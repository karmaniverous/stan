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

/**
 * Render a status label suitable for table/log rows.
 * Honors BORING/TTY via util/color.
 */
export const label = (kind: StatusKind): string => {
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
