/* src/stan/util/color.ts
 * Lightweight color helpers that respect STAN_BORING/NO_COLOR/FORCE_COLOR.
 * When boring mode is on (or not a TTY), return unstyled, uncolored strings.
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

export const yellow = (s: string): string => (isBoring() ? s : chalk.yellow(s));
export const cyan = (s: string): string => (isBoring() ? s : chalk.cyan(s));
export const red = (s: string): string => (isBoring() ? s : chalk.red(s));
export const green = (s: string): string => (isBoring() ? s : chalk.green(s));
export const gray = (s: string): string => (isBoring() ? s : chalk.gray(s));

export const bold = (s: string): string => (isBoring() ? s : chalk.bold(s));
export const dim = (s: string): string => (isBoring() ? s : chalk.dim(s));
export const underline = (s: string): string =>
  isBoring() ? s : chalk.underline(s);
