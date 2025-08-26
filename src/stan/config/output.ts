/* src/stan/config/output.ts
 * Ensure STAN workspace subdirectories and manage output/diff.
 */
import { existsSync, rmSync } from 'node:fs';
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { makeStanDirs } from '@/stan/paths';

/**
 * Ensure the STAN workspace exists and manage output/diff subdirectories.
 *
 * Behavior:
 * - Always ensure `stanPath/output` and `stanPath/diff` exist.
 * - Also ensure `stanPath/patch` exists so archives can include it.
 * - When `keep === false`, copy `output/archive.tar` to `diff/archive.prev.tar`
 *   if present, then clear only the `output` directory.
 *
 * @param cwd - Repo root.
 * @param stanPath - Workspace folder (e.g., `.stan`).
 * @param keep - When `true`, do not clear the output directory.
 * @returns Absolute path to the workspace root (`stanPath`).
 */
export const ensureOutputDir = async (
  cwd: string,
  stanPath: string,
  keep = false,
): Promise<string> => {
  const dirs = makeStanDirs(cwd, stanPath);

  await mkdir(dirs.rootAbs, { recursive: true });
  await mkdir(dirs.outputAbs, { recursive: true });
  await mkdir(dirs.diffAbs, { recursive: true });
  // Also ensure the patch workspace exists for diff/archives that include it
  await mkdir(dirs.patchAbs, { recursive: true });

  if (!keep) {
    const archiveTar = resolve(dirs.outputAbs, 'archive.tar');
    if (existsSync(archiveTar)) {
      try {
        await copyFile(archiveTar, resolve(dirs.diffAbs, 'archive.prev.tar'));
      } catch {
        // ignore copy errors
      }
    }

    const entries = await readdir(dirs.outputAbs, { withFileTypes: true });
    for (const e of entries) {
      rmSync(resolve(dirs.outputAbs, e.name), { recursive: true, force: true });
    }
  }

  return dirs.rootAbs;
};
