/** Shared filesystem helpers for STAN archiving & diffing.
 * See /stan.project.md for global & cross‑cutting requirements.
 */

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/** Recursively enumerate files under `root`, returning posix-style relative paths. */
export const listFiles = async (root: string): Promise<string[]> => {
  const out: string[] = [];
  const stack: string[] = ['.'];
  while (stack.length) {
    const rel = stack.pop() as string;
    const abs = resolve(root, rel);
    const entries = await readdir(abs, { withFileTypes: true });
    for (const e of entries) {
      const childRel = rel === '.' ? e.name : join(rel, e.name);
      if (e.isDirectory()) stack.push(childRel);
      else out.push(childRel.replace(/\\/g, '/'));
    }
  }
  return out;
};

/** Very simple .gitignore reader: treat non-globbing lines as prefix excludes. */
export const readGitignorePrefixes = async (cwd: string): Promise<string[]> => {
  const p = resolve(cwd, '.gitignore');
  if (!existsSync(p)) return [];
  const raw = await readFile(p, 'utf8').catch(() => '');
  if (!raw) return [];
  const lines = raw.split(/\r?\n/);
  const prefixes: string[] = [];
  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line || line.startsWith('#')) continue;
    // Only support simple prefix paths (no wildcards, no negations)
    if (/[!*?[\]]/.test(line)) continue;
    const noSlash = line.replace(/^\//, '').replace(/\/$/, '');
    if (noSlash.length > 0) prefixes.push(noSlash);
  }
  return prefixes;
};

const matchesPrefix = (f: string, p: string): boolean => {
  const norm = p.replace(/\\/g, '/');
  return f === norm || f.startsWith(norm + '/');
};

export type FilterOptions = {
  cwd: string;
  outputPath: string;
  includeOutputDir: boolean;
  includes?: string[];
  excludes?: string[];
};

/** Filter a list of relative paths according to includes/excludes/gitignore/output rules. */
export const filterFiles = async (
  files: string[],
  {
    cwd,
    outputPath,
    includeOutputDir,
    includes = [],
    excludes = [],
  }: FilterOptions,
): Promise<string[]> => {
  const outRelNorm = outputPath.replace(/\\/g, '/');
  const gitignorePrefixes = await readGitignorePrefixes(cwd);

  const deny: string[] = [
    'node_modules',
    '.git',
    ...gitignorePrefixes,
    ...excludes,
  ];
  if (!includeOutputDir) deny.push(outRelNorm);

  if (includes.length > 0) {
    return files.filter((f) => includes.some((p) => matchesPrefix(f, p)));
  }
  return files.filter((f) => !deny.some((p) => matchesPrefix(f, p)));
};

/** Ensure <outputPath> and <outputPath>/.diff exist, returning their absolute paths. */
export const ensureOutAndDiff = async (
  cwd: string,
  outputPath: string,
): Promise<{ outDir: string; diffDir: string }> => {
  const outDir = resolve(cwd, outputPath);
  await mkdir(outDir, { recursive: true });
  const diffDir = join(outDir, '.diff');
  await mkdir(diffDir, { recursive: true });
  return { outDir, diffDir };
};
