/* src/stan/archive/util.ts
 * Shared helpers for archive/diff creation.
 */
import { yellow } from '@/stan/util/color';

const isUnder = (prefix: string, p: string): boolean =>
  p === prefix || p.startsWith(`${prefix}/`);

/**
 * Make a tar filter that excludes:
 * - <stanPath>/diff/**
 * - <stanPath>/output/archive.tar
 * - <stanPath>/output/archive.diff.tar
 * - <stanPath>/output/archive.warnings.txt
 */
export const makeTarFilter = (stanPath: string) => {
  const base = stanPath.replace(/\\/g, '/');
  return (p: string): boolean =>
    !(
      isUnder(`${base}/diff`, p) ||
      p === `${base}/output/archive.tar` ||
      p === `${base}/output/archive.diff.tar` ||
      p === `${base}/output/archive.warnings.txt`
    );
};

/** Log archive classifier warnings consistently (no file output). */
export const logArchiveWarnings = (warningsBody: string): void => {
  const trimmed = (warningsBody ?? '').trim();
  if (trimmed && trimmed !== 'No archive warnings.') {
    // Single, concise section; TTY-aware color via yellow()
    console.log(`${yellow('stan: archive warnings')}\n${trimmed}`);
  }
};
