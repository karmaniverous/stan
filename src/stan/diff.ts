/**
 * Diff helpers for the stan tool.
 *
 * UPDATED REQUIREMENTS:
 * - Always create <baseName>.diff.tar whenever the archive script runs.
 * - Do NOT update an existing snapshot during normal runs.
 * - Create or update the snapshot when:
 *    - The archive script runs and a snapshot does NOT exist (create), or
 *    - The user runs `stan snap` (replace).
 * - If no snapshot exists when creating diff, write a diff tar equal to the full archive.
 * - Snapshot and sentinel files live under <outputPath>/.diff/.
 *
 * NEW (combine mode requirement):
 * - When includeOutputDirInDiff === true, include the entire <outputPath> (excluding <outputPath>/.diff)
 *   inside the diff tar, even if no source files changed.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { ensureOutAndDiff, filterFiles, listFiles } from './fs';

type TarLike = {
  create: (
    opts: {
      file: string;
      cwd?: string;
      filter?: (path: string, stat: unknown) => boolean;
    },
    files: string[],
  ) => Promise<void>;
};

export type SnapshotUpdateMode = 'never' | 'createIfMissing' | 'replace';

const computeCurrentHashes = async (
  cwd: string,
  relFiles: string[],
): Promise<Record<string, string>> => {
  const current: Record<string, string> = {};
  for (const rel of relFiles) {
    const abs = resolve(cwd, rel);
    const buf = await readFile(abs);
    const h = createHash('sha256').update(buf).digest('hex');
    current[rel] = h;
  }
  return current;
};

const snapshotPathFor = (outDir: string): string =>
  join(outDir, '.diff', '.archive.snapshot.json');

const sentinelPathFor = (outDir: string): string =>
  join(outDir, '.diff', '.stan_no_changes');

/**
 * Compute (and optionally update) the snapshot file in <outputPath>/.diff/.
 * Returns the absolute snapshot path.
 */
export const writeArchiveSnapshot = async ({
  cwd,
  outputPath,
  includes,
  excludes,
}: {
  cwd: string;
  outputPath: string;
  includes?: string[];
  excludes?: string[];
}): Promise<string> => {
  const { outDir } = await ensureOutAndDiff(cwd, outputPath);

  const all = await listFiles(cwd);
  const filtered = await filterFiles(all, {
    cwd,
    outputPath,
    includeOutputDir: false,
    includes: includes ?? [],
    excludes: excludes ?? [],
  });

  const current = await computeCurrentHashes(cwd, filtered);
  const snapPath = snapshotPathFor(outDir);
  await writeFile(snapPath, JSON.stringify(current, null, 2), 'utf8');
  return snapPath;
};

/**
 * Create a diff tar at <outputPath>/<baseName>.diff.tar.
 * - If snapshot exists: include only changed files.
 * - If no snapshot exists: include full file list (diff equals full archive).
 * - Snapshot update behavior is controlled by updateSnapshot:
 *   - 'never': do not write snapshot.
 *   - 'createIfMissing': write snapshot only if it does not exist.
 *   - 'replace': always write snapshot (used by `stan snap`).
 * - When includeOutputDirInDiff === true, also include the entire <outputPath> tree
 *   (excluding <outputPath>/.diff) regardless of change list length.
 */
export const createArchiveDiff = async ({
  cwd,
  outputPath,
  baseName,
  includes,
  excludes,
  updateSnapshot = 'createIfMissing',
  includeOutputDirInDiff = false,
}: {
  cwd: string;
  outputPath: string;
  baseName: string;
  includes?: string[];
  excludes?: string[];
  updateSnapshot?: SnapshotUpdateMode;
  includeOutputDirInDiff?: boolean;
}): Promise<{ diffPath: string }> => {
  const { outDir, diffDir } = await ensureOutAndDiff(cwd, outputPath);

  // Build filtered file list in repo root (cwd).
  const all = await listFiles(cwd);
  const filtered = await filterFiles(all, {
    cwd,
    outputPath,
    includeOutputDir: false, // snapshot and change list are source-only
    includes: includes ?? [],
    excludes: excludes ?? [],
  });

  // Compute current snapshot
  const current = await computeCurrentHashes(cwd, filtered);

  const snapPath = snapshotPathFor(outDir);
  const hasPrev = existsSync(snapPath);
  const prev: Record<string, string> = hasPrev
    ? (JSON.parse(await readFile(snapPath, 'utf8')) as Record<string, string>)
    : {};

  // Determine changed files when snapshot exists; else include full list.
  const changed: string[] = hasPrev
    ? filtered.filter((rel) => !prev[rel] || prev[rel] !== current[rel])
    : [...filtered];

  const diffPath = join(outDir, `${baseName}.diff.tar`);
  const tar = (await import('tar')) as unknown as TarLike;

  if (includeOutputDirInDiff) {
    // Always include the output directory (exclude .diff and archive files created during this run)
    const files = Array.from(new Set([...changed, outputPath]));
    const isUnder = (prefix: string, p: string): boolean =>
      p === prefix || p.startsWith(`${prefix}/`);

    await tar.create(
      {
        file: diffPath,
        cwd,
        filter: (p: string) =>
          !(
            isUnder(`${outputPath}/.diff`, p) ||
            p === `${outputPath}/archive.tar` ||
            p === `${outputPath}/archive.diff.tar`
          ),
      },
      files,
    );
  } else if (changed.length === 0) {
    // Nothing changed; write a sentinel to avoid empty tar behavior.
    const sentinel = sentinelPathFor(outDir);
    await writeFile(sentinel, 'no changes', 'utf8');
    await tar.create({ file: diffPath, cwd: diffDir }, ['.stan_no_changes']);
  } else {
    await tar.create({ file: diffPath, cwd }, changed);
  }

  // Update snapshot per mode
  if (updateSnapshot === 'replace') {
    await writeFile(snapPath, JSON.stringify(current, null, 2), 'utf8');
  } else if (updateSnapshot === 'createIfMissing' && !hasPrev) {
    await writeFile(snapPath, JSON.stringify(current, null, 2), 'utf8');
  }
  // 'never' => leave snapshot untouched

  return { diffPath };
};
