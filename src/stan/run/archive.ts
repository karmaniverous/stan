// src/stan/run/archive.ts
import { existsSync } from 'node:fs';
import { readdir, rm } from 'node:fs/promises';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path, { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { packageDirectorySync } from 'package-directory';

import { cyan, green } from '@/stan/util/color';

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

/**
 * Resolve the packaged system monolith (dist/stan.system.md) from this module.
 */
const resolvePackagedSystemMonolith = (): string | null => {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const moduleRoot = packageDirectorySync({ cwd: here });
    if (!moduleRoot) return null;
    const p = path.join(moduleRoot, 'dist', 'stan.system.md');
    return existsSync(p) ? p : null;
  } catch {
    return null;
  }
};

/**
 * Write the packaged monolith to <stanPath>/system/stan.system.md for archiving,
 * and return a cleanup function that restores prior state (or removes the file).
 */
const preparePackagedSystemPrompt = async (
  cwd: string,
  stanPath: string,
): Promise<() => Promise<void>> => {
  const packaged = resolvePackagedSystemMonolith();
  if (!packaged) return async () => {};

  const sysDir = path.resolve(cwd, stanPath, 'system');
  await mkdir(sysDir, { recursive: true });
  const dest = path.join(sysDir, 'stan.system.md');

  const existed = existsSync(dest);
  let original: string | null = null;
  if (existed) {
    try {
      original = await readFile(dest, 'utf8');
    } catch {
      original = null;
    }
  }
  const body = await readFile(packaged, 'utf8');
  await writeFile(dest, body, 'utf8');

  return async () => {
    try {
      if (existed) {
        if (original !== null) await writeFile(dest, original, 'utf8');
      } else {
        await rm(dest, { force: true });
      }
    } catch {
      // best-effort
    }
  };
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

  console.log(`stan: start "${cyan('archive')}"`);
  // Ensure the packaged system prompt is present during archiving (full archive).
  const restore = await preparePackagedSystemPrompt(cwd, config.stanPath);
  let archivePath = '';
  let diffPath = '';
  try {
    archivePath = await createArchive(cwd, config.stanPath, {
      includeOutputDir: includeOutputs,
      includes: config.includes ?? [],
      excludes: config.excludes ?? [],
    });
    console.log(
      `stan: ${green('done')} "${cyan('archive')}" -> ${cyan(
        archivePath.replace(/\\/g, '/'),
      )}`,
    );

    console.log(`stan: start "${cyan('archive (diff)')}"`);
    // We intentionally do not force-include the system prompt in the diff archive.
    ({ diffPath } = await createArchiveDiff({
      cwd,
      stanPath: config.stanPath,
      baseName: 'archive',
      includes: config.includes ?? [],
      excludes: config.excludes ?? [],
      updateSnapshot: 'createIfMissing',
      includeOutputDirInDiff: includeOutputs,
    }));
    console.log(
      `stan: ${green('done')} "${cyan('archive (diff)')}" -> ${cyan(
        diffPath.replace(/\\/g, '/'),
      )}`,
    );
  } finally {
    // Remove/restore the ephemeral system prompt on disk.
    await restore();
  }

  if (includeOutputs) {
    await cleanupOutputsAfterCombine(dirs.outputAbs);
  }
  await cleanupPatchDirAfterArchive(cwd, config.stanPath);

  return { archivePath, diffPath };
};
