/**
 * Diff helpers for the stan tool.
 *
 * REQUIREMENTS (current):
 * - `createArchiveDiff({ cwd, outputPath, baseName, includes?, excludes? })`:
 *   - Maintain <outputPath>/.archive.snapshot.json (path → sha256 hex).
 *   - On first run or when no changes detected, write a sentinel `.stan_no_changes`
 *     into the output directory and create `<baseName>.diff.tar` containing just that sentinel.
 *   - When changes are detected, create `<baseName>.diff.tar` containing only changed files
 *     (added or modified). Deletions are tracked in the snapshot but not included in the tar.
 * - Honor includes/excludes and basic .gitignore prefix rules via shared helpers.
 *
 * NEW REQUIREMENTS:
 * - Diff support artifacts are stored under <outputPath>/.diff:
 *   - snapshot: <outputPath>/.diff/.archive.snapshot.json
 *   - sentinel: <outputPath>/.diff/.stan_no_changes
 * - The produced diff tar remains at <outputPath>/<baseName>.diff.tar.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { filterFiles, listFiles } from './fs';

type TarLike = {
  create: (
    opts: { file: string; cwd?: string },
    files: string[],
  ) => Promise<void>;
};

export const createArchiveDiff = async ({
  cwd,
  outputPath,
  baseName,
  includes,
  excludes,
}: {
  cwd: string;
  outputPath: string;
  baseName: string;
  includes?: string[];
  excludes?: string[];
}): Promise<{ diffPath: string }> => {
  const outDir = resolve(cwd, outputPath);
  await mkdir(outDir, { recursive: true });

  const diffDir = join(outDir, '.diff');
  await mkdir(diffDir, { recursive: true });

  // Build filtered file list in repo root (cwd).
  const all = await listFiles(cwd);
  const filtered = await filterFiles(all, {
    cwd,
    outputPath,
    includeOutputDir: false,
    includes: includes ?? [],
    excludes: excludes ?? [],
  });

  // Compute sha256 for each file.
  const current: Record<string, string> = {};
  for (const rel of filtered) {
    const abs = resolve(cwd, rel);
    const buf = await readFile(abs);
    const h = createHash('sha256').update(buf).digest('hex');
    current[rel] = h;
  }

  const snapshotPath = join(diffDir, '.archive.snapshot.json');
  const prev: Record<string, string> = existsSync(snapshotPath)
    ? (JSON.parse(await readFile(snapshotPath, 'utf8')) as Record<
        string,
        string
      >)
    : {};

  const changed = new Set<string>();
  for (const [rel, hash] of Object.entries(current)) {
    if (!prev[rel] || prev[rel] !== hash) changed.add(rel);
  }
  // (We do not include deletions in the tar; they are reflected by missing keys in `current`.)

  const diffPath = join(outDir, `${baseName}.diff.tar`);
  // Dynamic import across package boundary; local type TarLike narrows to the
  // subset we use. Cast justified and localized at the boundary.
  const tar = (await import('tar')) as unknown as TarLike;

  if (changed.size === 0 || !existsSync(snapshotPath)) {
    // First run or no changes: write a sentinel to advertise no changes.
    const sentinel = join(diffDir, '.stan_no_changes');
    await writeFile(sentinel, 'no changes', 'utf8');
    await tar.create({ file: diffPath, cwd: diffDir }, ['.stan_no_changes']);
  } else {
    await tar.create({ file: diffPath, cwd }, Array.from(changed));
  }

  // Persist current snapshot for next run.
  await writeFile(snapshotPath, JSON.stringify(current, null, 2), 'utf8');

  return { diffPath };
};
