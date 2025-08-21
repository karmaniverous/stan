// src/stan/run/archive.ts
import { readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

import { createArchive } from '../archive';
import type { ContextConfig } from '../config';
import { createArchiveDiff } from '../diff';
import { makeStanDirs } from '../paths';

/** Remove on-disk outputs after archiving when combine=true (preserve archives). */
const cleanupOutputsAfterCombine = async (outAbs: string): Promise<void> => {
  const entries = await readdir(outAbs, { withFileTypes: true });
  const keepNames = new Set(['archive.tar', 'archive.diff.tar']);
  await Promise.all(
    entries.map(async (e) => {
      if (keepNames.has(e.name)) return;
      await rm(resolve(outAbs, e.name), { recursive: true, force: true });
    }),
  );
};

/** Clear <stanPath>/patch contents after archiving (preserve the directory). */
const cleanupPatchDirAfterArchive = async (
  cwd: string,
  stanPath: string,
): Promise<void> => {
  const dirs = makeStanDirs(cwd, stanPath);
  try {
    const entries = await readdir(dirs.patchAbs, { withFileTypes: true });
    await Promise.all(
      entries.map((e) =>
        rm(resolve(dirs.patchAbs, e.name), { recursive: true, force: true }),
      ),
    );
  } catch {
    // best-effort
  }
};

export const archivePhase = async (args: {
  cwd: string;
  config: ContextConfig;
  includeOutputs: boolean;
}): Promise<{ archivePath: string; diffPath: string }> => {
  const { cwd, config, includeOutputs } = args;
  const dirs = makeStanDirs(cwd, config.stanPath);

  console.log('stan: start "archive"');
  const archivePath = await createArchive(cwd, config.stanPath, {
    includeOutputDir: includeOutputs,
    includes: config.includes ?? [],
    excludes: config.excludes ?? [],
  });
  console.log(`stan: done "archive" -> ${archivePath.replace(/\\/g, '/')}`);

  console.log('stan: start "archive (diff)"');
  const { diffPath } = await createArchiveDiff({
    cwd,
    stanPath: config.stanPath,
    baseName: 'archive',
    includes: config.includes ?? [],
    excludes: config.excludes ?? [],
    updateSnapshot: 'createIfMissing',
    includeOutputDirInDiff: includeOutputs,
  });
  console.log(`stan: done "archive (diff)" -> ${diffPath.replace(/\\/g, '/')}`);

  if (includeOutputs) {
    await cleanupOutputsAfterCombine(dirs.outputAbs);
  }
  await cleanupPatchDirAfterArchive(cwd, config.stanPath);

  return { archivePath, diffPath };
};
