import { green, red, yellow } from '@/stan/util/color';

/**
 * Status line helpers with BORING/TTY-aware styling.
 * - TTY: symbols with color (✔ / ✖ / △).
 * - BORING or non-TTY: bracketed tokens ([OK] / [FAIL] / [PARTIAL]).
 */

const isTTY = Boolean(
  (process.stdout as unknown as { isTTY?: boolean })?.isTTY,
);

const isBoring = (): boolean =>
  process.env.STAN_BORING === '1' ||
  process.env.NO_COLOR === '1' ||
  process.env.FORCE_COLOR === '0' ||
  !isTTY;

export const statusOk = (s: string): string =>
  isBoring() ? `[OK] ${s}` : green(`✔ ${s}`);

export const statusFail = (s: string): string =>
  isBoring() ? `[FAIL] ${s}` : red(`✖ ${s}`);

export const statusPartial = (s: string): string =>
  isBoring() ? `[PARTIAL] ${s}` : yellow(`△ ${s}`);
