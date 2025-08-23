/* src/stan/util/color.ts
 * Lightweight color helpers that respect STAN_BORING/NO_COLOR/FORCE_COLOR.
 * When boring mode is on, return uncolored strings.
 */
import chalk from 'chalk';

const isBoring = (): boolean =>
  process.env.STAN_BORING === '1' ||
  process.env.NO_COLOR === '1' ||
  process.env.FORCE_COLOR === '0';

export const yellow = (s: string): string => (isBoring() ? s : chalk.yellow(s));
export const cyan = (s: string): string => (isBoring() ? s : chalk.cyan(s));
export const red = (s: string): string => (isBoring() ? s : chalk.red(s));
