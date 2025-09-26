// src/test/helpers.ts
import { rm } from 'node:fs/promises';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Remove a directory with a short series of retries to mitigate transient
 * EBUSY/ENOTEMPTY on Windows test runners.
 *
 * @param dir - Absolute path to remove.
 * @param backoffMs - Backoff series in milliseconds (tunable).
 */
export const rmDirWithRetries = async (
  dir: string,
  // Extend default backoff to better absorb transient rmdir EBUSY on CI
  backoffMs: number[] = [50, 100, 200, 400, 800, 1600],
): Promise<void> => {
  let lastErr: unknown;
  for (let i = 0; i <= backoffMs.length; i += 1) {
    try {
      await rm(dir, { recursive: true, force: true });
      return;
    } catch (e) {
      lastErr = e;
      if (i === backoffMs.length) break;
      await delay(backoffMs[i]);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
};
