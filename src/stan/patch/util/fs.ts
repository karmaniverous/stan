/* src/stan/patch/util/fs.ts */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Ensure the parent directory of the provided file path exists.
 * Best‑effort: errors are swallowed to avoid interfering with patch flows.
 *
 * @param p - Absolute or repo‑relative file path whose parent directory will be created.
 * @returns A promise that resolves when the directory exists (or the attempt is skipped).
 */
export const ensureParentDir = async (p: string): Promise<void> => {
  const dir = path.dirname(p);
  try {
    await mkdir(dir, { recursive: true });
  } catch {
    // best-effort
  }
};
