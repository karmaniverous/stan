/* src/stan/util/color.ts
 * Lightweight color helpers that respect STAN_BORING/NO_COLOR/FORCE_COLOR.
 * When boring mode is on (or not a TTY), return unstyled, uncolored strings.
 * All helpers return unstyled output when BORING/non‑TTY is detected.
 */
import chalk from 'chalk';

const isTTY = Boolean(
  (process.stdout as unknown as { isTTY?: boolean })?.isTTY,
);
const isBoring = (): boolean => {
  return (
    process.env.STAN_BORING === '1' ||
    process.env.NO_COLOR === '1' ||
    process.env.FORCE_COLOR === '0' ||
    !isTTY
  );
};

/** Colorize text as a warning (yellow) unless boring mode is enabled.
 * @param s - Text to colorize.
 * @returns Potentially colored string (unstyled in boring/non‑TTY). */
export const yellow = (s: string): string => (isBoring() ? s : chalk.yellow(s));

/** Colorize text as informational (cyan).
 * @param s - Text to colorize.
 * @returns Potentially colored string (unstyled in boring/non‑TTY). */
export const cyan = (s: string): string => (isBoring() ? s : chalk.cyan(s));

/** Colorize text as an error (red).
 * @param s - Text to colorize.
 * @returns Potentially colored string (unstyled in boring/non‑TTY). */
export const red = (s: string): string => (isBoring() ? s : chalk.red(s));

/** Colorize text as success (green).
 * @param s - Text to colorize.
 * @returns Potentially colored string (unstyled in boring/non‑TTY). */
export const green = (s: string): string => (isBoring() ? s : chalk.green(s));

/** Colorize text as de‑emphasized (gray).
 * @param s - Text to colorize.
 * @returns Potentially colored string (unstyled in boring/non‑TTY). */
export const gray = (s: string): string => (isBoring() ? s : chalk.gray(s));

/** Render bold text when not in boring mode.
 * @param s - Text to style.
 * @returns Styled or unstyled text depending on mode. */
export const bold = (s: string): string => (isBoring() ? s : chalk.bold(s));

/** Render dim text when not in boring mode.
 * @param s - Text to style.
 * @returns Styled or unstyled text depending on mode. */
export const dim = (s: string): string => (isBoring() ? s : chalk.dim(s));

/** Render underlined text when not in boring mode.
 * @param s - Text to style.
 * @returns Styled or unstyled text depending on mode. */
export const underline = (s: string): string =>
  isBoring() ? s : chalk.underline(s);
