/* src/stan/run/summary.ts
 * Shared BORING/TTY-aware summary line helper for progress tables/logs.
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

export type SummaryCounts = {
  waiting: number;
  running: number;
  quiet: number;
  stalled: number;
  ok: number;
  cancelled: number;
  fail: number;
  timeout: number;
};

export const renderSummary = (
  elapsed: string,
  counts: SummaryCounts,
  boring: boolean,
): string => {
  const sep = ' • ';
  if (boring) {
    return [
      `${elapsed}`,
      `waiting ${counts.waiting.toString()}`,
      `running ${counts.running.toString()}`,
      `quiet ${counts.quiet.toString()}`,
      `stalled ${counts.stalled.toString()}`,
      `TIMEOUT ${counts.timeout.toString()}`,
      `OK ${counts.ok.toString()}`,
      `FAIL ${counts.fail.toString()}`,
      `CANCELLED ${counts.cancelled.toString()}`,
    ].join(sep);
  }
  return [
    `${elapsed}`,
    gray(`⏸ ${counts.waiting.toString()}`),
    blue(`▶ ${counts.running.toString()}`),
    cyan(`⏱ ${counts.quiet.toString()}`),
    magenta(`⏱ ${counts.stalled.toString()}`),
    red(`⏱ ${counts.timeout.toString()}`),
    green(`✔ ${counts.ok.toString()}`),
    red(`✖ ${counts.fail.toString()}`),
    black(`◼ ${counts.cancelled.toString()}`),
  ].join(sep);
};
