/* src/stan/patch/util/fs.ts */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

export const ensureParentDir = async (p: string): Promise<void> => {
  const dir = path.dirname(p);
  try {
    await mkdir(dir, { recursive: true });
  } catch {
    // best-effort
  }
};
