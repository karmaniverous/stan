/**
 * Diff helpers for the stan tool (updated for stanPath layout).
 *
 * - Always create <baseName>.diff.tar under <stanPath>/output whenever the archive script runs.
 * - Snapshot lives under <stanPath>/diff/.archive.snapshot.json.
 * - Sentinel lives under <stanPath>/diff/.stan_no_changes.
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

const snapshotPathFor = (diffDir: string): string =>
  join(diffDir, '.archive.snapshot.json');

const sentinelPathFor = (diffDir: string): string =>
  join(diffDir, '.stan_no_changes');

/**
 * Compute (and optionally update) the snapshot file in <stanPath>/diff/.
 * Returns the absolute snapshot path.
 */
export const writeArchiveSnapshot = async ({
  cwd,
  stanPath,
  includes,
  excludes,
}: {
  cwd: string;
  stanPath: string;
  includes?: string[];
  excludes?: string[];
}): Promise<string> => {
  const { diffDir } = await ensureOutAndDiff(cwd, stanPath);

  const all = await listFiles(cwd);
  const filtered = await filterFiles(all, {
    cwd,
    stanPath,
    includeOutputDir: false,
    includes: includes ?? [],
    excludes: excludes ?? [],
  });

  const current = await computeCurrentHashes(cwd, filtered);
  const snapPath = snapshotPathFor(diffDir);
  await writeFile(snapPath, JSON.stringify(current, null, 2), 'utf8');
  return snapPath;
};

/**
 * Create a diff tar at <stanPath>/output/<baseName>.diff.tar.
 * - If snapshot exists: include only changed files.
 * - If no snapshot exists: include full file list (diff equals full archive).
 * - Snapshot update behavior is controlled by updateSnapshot.
 * - When includeOutputDirInDiff === true, also include the entire <stanPath>/output tree
 *   (excluding <stanPath>/diff and the two archive files) regardless of change list length.
 */
export const createArchiveDiff = async ({
  cwd,
  stanPath,
  baseName,
  includes,
  excludes,
  updateSnapshot = 'createIfMissing',
  includeOutputDirInDiff = false,
}: {
  cwd: string;
  stanPath: string;
  baseName: string;
  includes?: string[];
  excludes?: string[];
  updateSnapshot?: SnapshotUpdateMode;
  includeOutputDirInDiff?: boolean;
}): Promise<{ diffPath: string }> => {
  const { outDir, diffDir } = await ensureOutAndDiff(cwd, stanPath);

  const all = await listFiles(cwd);
  const filtered = await filterFiles(all, {
    cwd,
    stanPath,
    includeOutputDir: false,
    includes: includes ?? [],
    excludes: excludes ?? [],
  });

  const current = await computeCurrentHashes(cwd, filtered);

  const snapPath = snapshotPathFor(diffDir);
  const hasPrev = existsSync(snapPath);
  const prev: Record<string, string> = hasPrev
    ? (JSON.parse(await readFile(snapPath, 'utf8')) as Record<string, string>)
    : {};

  const changed: string[] = hasPrev
    ? filtered.filter((rel) => !prev[rel] || prev[rel] !== current[rel])
    : [...filtered];

  const diffPath = join(outDir, `${baseName}.diff.tar`);
  const tar = (await import('tar')) as unknown as TarLike;

  if (includeOutputDirInDiff) {
    const files = Array.from(
      new Set([...changed, `${stanPath.replace(/\\/g, '/')}/output`]),
    );
    const isUnder = (prefix: string, p: string): boolean =>
      p === prefix || p.startsWith(`${prefix}/`);

    await tar.create(
      {
        file: diffPath,
        cwd,
        filter: (p: string) =>
          !(
            isUnder(`${stanPath}/diff`, p) ||
            isUnder(`${stanPath}/.diff`, p) ||
            p === `${stanPath}/output/archive.tar` ||
            p === `${stanPath}/output/archive.diff.tar` ||
            p === `${stanPath}/archive.tar` ||
            p === `${stanPath}/archive.diff.tar`
          ),
      },
      files,
    );
  } else if (changed.length === 0) {
    const sentinel = sentinelPathFor(diffDir);
    await writeFile(sentinel, 'no changes', 'utf8');
    await tar.create({ file: diffPath, cwd: diffDir }, ['.stan_no_changes']);
  } else {
    await tar.create({ file: diffPath, cwd }, changed);
  }

  if (updateSnapshot === 'replace') {
    await writeFile(snapPath, JSON.stringify(current, null, 2), 'utf8');
  } else if (updateSnapshot === 'createIfMissing' && !hasPrev) {
    await writeFile(snapPath, JSON.stringify(current, null, 2), 'utf8');
  }

  return { diffPath };
};
