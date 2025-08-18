/**
 * @file src/context/diff.ts
 * @description Diff helpers for the ctx tool.
 *
 * @requirements
 * - Provide a `createArchiveDiff` API used by the runner to implement `-d/--diff`.
 * - When invoked, if an existing `archive.tar` is present under the output directory,
 *   copy it to `archive.prev.tar` BEFORE any new archive is created.
 * - Produce a `archive.diff.tar` tarball that contains only files that have changed
 *   since the last run. "Changed" means: added or modified relative to the previous
 *   snapshot. Deletions are recorded in the snapshot but are not represented in the
 *   tarball.
 * - Store the snapshot in `<outputPath>/.archive.snapshot.json` (hidden file) so the
 *   next diff can be computed. The snapshot format is stable JSON: a map of relative
 *   POSIX paths to SHA-256 hex digests.
 * - Exclude `node_modules` and the `outputPath` itself from the snapshot and diff.
 * - Never rely on GNU/BSD tar "incremental" flags to keep behavior cross‑platform.
 * - Do not throw if no prior snapshot/tar exists; create a diff of all tracked files.
 *
 * @tsdoc
 * All functions are exported with explicit types and have no `any` usage.
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { constants, copyFile, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join, posix, resolve } from 'node:path';

export type Snapshot = Record<string, string>;

export interface DiffOptions {
  /** Absolute or CWD-relative project root. */
  cwd: string;
  /** Relative path under `cwd` where outputs are written. */
  outputPath: string;
  /**
   * Base filename for generated tar artifacts (without extension).
   * Defaults to "archive".
   */
  baseName?: string;
}

/**
 * Compute a SHA‑256 digest for a file.
 */
const hashFile = async (absPath: string): Promise<string> =>
  await new Promise<string>((resolveHash, rejectHash) => {
    const h = createHash('sha256');
    const s = createReadStream(absPath);
    s.on('error', rejectHash);
    h.on('error', rejectHash);
    s.on('end', () => { resolveHash(h.digest('hex')); });
    s.pipe(h);
  });

/**
 * Recursively enumerate project files to include in snapshots/diffs.
 * Skips `node_modules`, `.git`, and the output directory.
 */
const enumerateFiles = async (rootAbs: string, outputAbs: string): Promise<string[]> => {
  const out: string[] = [];
  const stack: string[] = ['.'];

  while (stack.length) {
    const rel = stack.pop() as string;
    const abs = resolve(rootAbs, rel);
    const name = rel === '.' ? '.' : basename(abs);

    // Exclusions
    if (rel !== '.' && (name === 'node_modules' || name === '.git')) continue;
    if (outputAbs && abs === outputAbs) continue;

    const st = await stat(abs);

    if (st.isDirectory()) {
      const entries = await readdir(abs);
      for (const child of entries) {
        const childRel = rel === '.' ? child : posix.join(rel.replaceAll('\\', '/'), child);
        // Skip the output dir (by name match) even if nested symlinks, etc.
        if (outputAbs && resolve(rootAbs, childRel) === outputAbs) continue;
        stack.push(childRel);
      }
    } else if (st.isFile()) {
      // Normalize to POSIX-style relative path for stability.
      const posixRel = rel.replaceAll('\\', '/');
      out.push(posixRel);
    }
  }

  // deterministic order (useful for tests)
  out.sort();
  return out;
};

/**
 * Load the previous snapshot if present, else return `null`.
 */
export const loadSnapshot = async (cwd: string, outputPath: string): Promise<Snapshot | null> => {
  const snapPath = join(cwd, outputPath, '.archive.snapshot.json');
  try {
    const buf = await (await import('node:fs/promises')).readFile(snapPath);
    const json = JSON.parse(String(buf)) as Snapshot;
    return json;
  } catch {
    return null;
  }
};

/**
 * Persist the snapshot for the next run.
 */
export const saveSnapshot = async (cwd: string, outputPath: string, snapshot: Snapshot): Promise<string> => {
  const snapPath = join(cwd, outputPath, '.archive.snapshot.json');
  await mkdir(join(cwd, outputPath), { recursive: true });
  await writeFile(snapPath, JSON.stringify(snapshot, null, 2));
  return snapPath;
};

/**
 * Compute the current snapshot of the workspace.
 */
export const computeSnapshot = async (cwd: string, outputPath: string): Promise<Snapshot> => {
  const rootAbs = resolve(cwd);
  const outAbs = resolve(cwd, outputPath);
  const files = await enumerateFiles(rootAbs, outAbs);
  const snapshot: Snapshot = {};
  for (const rel of files) {
    const abs = resolve(rootAbs, rel);
    // Skip the output dir just in case
    if (abs === outAbs) continue;
    snapshot[rel] = await hashFile(abs);
  }
  return snapshot;
};

/**
 * Produce a list of changed/added relative paths between two snapshots.
 * Deletions are ignored (they cannot be represented in a tar).
 */
export const diffSnapshots = (prev: Snapshot | null, curr: Snapshot): string[] => {
  if (!prev) return Object.keys(curr);
  const changed: string[] = [];
  for (const [rel, hash] of Object.entries(curr)) {
    if (prev[rel] !== hash) changed.push(rel);
  }
  return changed.sort();
};

/**
 * Create a tar file at `destTarAbs` containing the given `paths` (relative to `cwd`).
 * Uses a manifest file to robustly pass long lists to `tar` cross‑platform.
 */
const tarFromList = async (cwd: string, destTarAbs: string, relPaths: string[]): Promise<void> => {
  await mkdir(resolve(destTarAbs, '..'), { recursive: true });

  // Ensure we have at least one entry (BSD/GNU tar can't create totally empty archives).
  let list = relPaths.slice();
  let placeholder: string | null = null;
  if (list.length === 0) {
    placeholder = '.ctx_no_changes';
    await writeFile(resolve(cwd, placeholder), 'no changes');
    list = [placeholder];
  }

  const listFile = destTarAbs + '.list';
  await writeFile(listFile, list.join('\n'));

  await new Promise<void>((resolveTar, rejectTar) => {
    const child = spawn('tar', ['-cf', destTarAbs, '-C', cwd, '-T', listFile], { stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('error', rejectTar);
    child.on('exit', (code) => {
      if (code === 0) resolveTar();
      else rejectTar(new Error(`tar exited with code ${code ?? -1}`));
    });
  });

  // Cleanup
  await rm(listFile, { force: true });
  if (placeholder) {
    await rm(resolve(cwd, placeholder), { force: true });
  }
};

/**
 * Main entry point used by the runner: copy `archive.tar` -> `archive.prev.tar`
 * if it exists, compute changes, build `archive.diff.tar`, and persist the snapshot.
 *
 * NOTE: This routine **does not** clear the output directory. Callers should either
 * pass `--keep` or treat `--diff` as implying keep‑mode (recommended) so that the
 * previous artifacts remain available.
 */
export const createArchiveDiff = async (options: DiffOptions): Promise<{ prevCopied: boolean; diffPath: string; snapshotPath: string }> => {
  const { cwd, outputPath, baseName = 'archive' } = options;
  const outAbs = resolve(cwd, outputPath);
  await mkdir(outAbs, { recursive: true });

  const tarPath = join(outAbs, `${baseName}.tar`);
  const prevTarPath = join(outAbs, `${baseName}.prev.tar`);
  const diffTarPath = join(outAbs, `${baseName}.diff.tar`);

  // 1) Copy previous tar if present.
  let prevCopied = false;
  try {
    await copyFile(tarPath, prevTarPath, constants.COPYFILE_FICLONE);
    prevCopied = true;
  } catch {
    // no-op, it's fine if it doesn't exist yet
  }

  // 2) Compute diff (prev snapshot -> current workspace)
  const [prevSnap, currSnap] = await Promise.all([loadSnapshot(cwd, outputPath), computeSnapshot(cwd, outputPath)]);
  const changed = diffSnapshots(prevSnap, currSnap);

  // 3) Create diff tar (changed only)
  await tarFromList(cwd, diffTarPath, changed);

  // 4) Save snapshot for the next run
  const snapshotPath = await saveSnapshot(cwd, outputPath, currSnap);

  return { prevCopied, diffPath: diffTarPath, snapshotPath };
};
