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

/**
 * Decorate a message as a success status line.
 *
 * @param s - Message to decorate.
 * @returns Styled string (TTY: colored "✔"; BORING/non‑TTY: "[OK] ...").
 */
export const statusOk = (s: string): string =>
  isBoring() ? `[OK] ${s}` : green(`✔ ${s}`);

/**
 * Decorate a message as a failure status line.
 *
 * @param s - Message to decorate.
 * @returns Styled string (TTY: colored "✖"; BORING/non‑TTY: "[FAIL] ...").
 */
export const statusFail = (s: string): string =>
  isBoring() ? `[FAIL] ${s}` : red(`✖ ${s}`);

/**
 * Decorate a message as a partial/indeterminate status line.
 *
 * @param s - Message to decorate.
 * @returns Styled string (TTY: colored "△"; BORING/non‑TTY: "[PARTIAL] ...").
 */
export const statusPartial = (s: string): string =>
  isBoring() ? `[PARTIAL] ${s}` : yellow(`△ ${s}`);
