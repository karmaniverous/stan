/** Shared filesystem helpers for STAN archiving & diffing.
 * See /stan.project.md for global & cross‑cutting requirements.
 */

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import picomatch from 'picomatch';

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
    if (/[!*?[\]]/.test(line) || line.includes('**')) continue;
    const noSlash = line.replace(/^\//, '').replace(/\/$/, '');
    if (noSlash.length > 0) prefixes.push(noSlash);
  }
  return prefixes;
};

const matchesPrefix = (f: string, p: string): boolean => {
  const norm = p.replace(/\\/g, '/').replace(/\/+$/, '');
  return f === norm || f.startsWith(norm + '/');
};

const hasGlob = (p: string): boolean =>
  /[*?[\]{}()!]/.test(p) || p.includes('**');

type Matcher = (f: string) => boolean;

const toMatcher = (pattern: string): Matcher => {
  const pat = pattern
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/\/+$/, '');
  if (!hasGlob(pat)) {
    if (!pat) return () => false;
    return (f) => matchesPrefix(f, pat);
  }
  const isMatch = picomatch(pat, { dot: true });
  return (f) => isMatch(f);
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

  // Allow-list mode: includes override excludes and default denials.
  if (includes.length > 0) {
    const allow: Matcher[] = includes.map(toMatcher);
    return files.filter((f) => allow.some((m) => m(f)));
  }

  // Deny-list mode: default denials + excludes + (optionally) outputPath
  const denyMatchers: Matcher[] = [
    // default denials by prefix
    (f) => matchesPrefix(f, 'node_modules'),
    (f) => matchesPrefix(f, '.git'),
    // .gitignore (prefix-only support)
    ...gitignorePrefixes.map((p) => (f: string) => matchesPrefix(f, p)),
    // user excludes (glob or prefix)
    ...excludes.map(toMatcher),
  ];

  if (!includeOutputDir) {
    denyMatchers.push((f) => matchesPrefix(f, outRelNorm));
  }

  return files.filter((f) => !denyMatchers.some((m) => m(f)));
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
