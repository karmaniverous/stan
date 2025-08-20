/** Shared filesystem helpers for STAN archiving & diffing.
 * See /stan.project.md for global & cross‑cutting requirements.
 */

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import ignoreFactory from 'ignore';
import picomatch from 'picomatch';

import { makeStanDirs } from './paths';

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

/** Build an "ignore" instance from .gitignore (full pattern semantics). */
const buildIgnoreFromGitignore = async (
  cwd: string,
): Promise<ReturnType<typeof ignoreFactory> | null> => {
  const p = resolve(cwd, '.gitignore');
  if (!existsSync(p)) return null;
  try {
    const raw = await readFile(p, 'utf8');
    const ig = ignoreFactory();
    ig.add(raw);
    return ig;
  } catch {
    return null;
  }
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
  stanPath: string;
  includeOutputDir: boolean;
  includes?: string[];
  excludes?: string[];
};

/** Filter a list of relative paths according to includes/excludes/gitignore/output rules. */
export const filterFiles = async (
  files: string[],
  {
    cwd,
    stanPath,
    includeOutputDir,
    includes = [],
    excludes = [],
  }: FilterOptions,
): Promise<string[]> => {
  const stanRel = stanPath.replace(/\\/g, '/');
  const ig = await buildIgnoreFromGitignore(cwd);

  // Allow-list mode: includes override excludes and default denials.
  if (includes.length > 0) {
    const allow: Matcher[] = includes.map(toMatcher);
    return files.filter((f) => allow.some((m) => m(f)));
  }

  // Deny-list mode: default denials + excludes + (optionally) output/diff
  const denyMatchers: Matcher[] = [
    // default denials by prefix
    (f) => matchesPrefix(f, 'node_modules'),
    (f) => matchesPrefix(f, '.git'),
    // .gitignore (full semantics via "ignore")
    ...(ig ? [(f: string) => ig.ignores(f)] : []),
    // user excludes (glob or prefix)
    ...excludes.map(toMatcher),
    // always exclude <stanPath>/diff
    (f) => matchesPrefix(f, `${stanRel}/diff`),
  ];

  if (!includeOutputDir) {
    denyMatchers.push((f) => matchesPrefix(f, `${stanRel}/output`));
  }

  return files.filter((f) => !denyMatchers.some((m) => m(f)));
};

/** Ensure <stanPath>/output and <stanPath>/diff exist, returning their absolute paths. */
export const ensureOutAndDiff = async (
  cwd: string,
  stanPath: string,
): Promise<{ outDir: string; diffDir: string }> => {
  const dirs = makeStanDirs(cwd, stanPath);
  await mkdir(dirs.rootAbs, { recursive: true });
  await mkdir(dirs.outputAbs, { recursive: true });
  await mkdir(dirs.diffAbs, { recursive: true });
  return { outDir: dirs.outputAbs, diffDir: dirs.diffAbs };
};
