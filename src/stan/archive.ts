/* src/stan/archive.ts
 * Create a project archive under the output directory.
 * NOTE: Global and cross‑cutting requirements live in /stan.project.md.
 *
 * REQUIREMENTS (current):
 * - Create <outputPath>/archive.tar from project root, excluding node_modules/.git and (by default) the outputPath.
 * - Options:
 *   - includeOutputDir?: when true, do include the outputPath directory.
 *   - fileName?: override base name (must end with .tar).
 * - Honor includes/excludes from config:
 *   - Non-globbing, path-prefix semantics.
 *   - Includes override excludes (explicit includes win).
 * - NEW: Respect simple .gitignore entries as prefix excludes (no globbing).
 * - Return the absolute path to the created tarball.
 * - Zero "any" usage.
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

type TarLike = {
  create: (
    opts: { file: string; cwd?: string },
    files: string[],
  ) => Promise<void>;
};

export type CreateArchiveOptions = {
  /** When true, include the output directory in the tarball even if it is normally excluded. */
  includeOutputDir?: boolean;
  /** Override the output filename. Must end with ".tar". Defaults to "archive.tar". */
  fileName?: string;
  /** Additional includes/excludes - reserved for future filtering (non‑globbing for now). */
  includes?: string[];
  excludes?: string[];
};

const listFiles = async (root: string): Promise<string[]> => {
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

const readGitignorePrefixes = async (cwd: string): Promise<string[]> => {
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

export const createArchive = async (
  cwd: string,
  outputPath: string,
  options: CreateArchiveOptions = {},
): Promise<string> => {
  const {
    includeOutputDir = false,
    fileName: rawFileName,
    includes = [],
    excludes = [],
  } = options;

  let fileName = rawFileName ?? 'archive.tar';
  if (!fileName.endsWith('.tar')) fileName += '.tar';

  const root = cwd;
  const outDir = resolve(root, outputPath);
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });

  const all = await listFiles(root);
  const outRelNorm = outputPath.replace(/\\/g, '/');

  const matchesPrefix = (f: string, p: string): boolean => {
    const norm = p.replace(/\\/g, '/');
    return f === norm || f.startsWith(norm + '/');
  };

  // Build deny-list: node_modules/.git, output (unless included), .gitignore prefixes, and explicit excludes.
  const gitignorePrefixes = await readGitignorePrefixes(root);
  const deny: string[] = [
    'node_modules',
    '.git',
    ...gitignorePrefixes,
    ...excludes,
  ];
  if (!includeOutputDir) deny.push(outRelNorm);

  const files = all.filter((f) => {
    // Includes act as allow-list and override all excludes
    const hasIncludes = includes.length > 0;
    if (hasIncludes) {
      const included = includes.some((p) => matchesPrefix(f, p));
      return included;
    }

    // No includes: apply deny-list as prefix matches
    const isDenied = deny.some((p) => matchesPrefix(f, p));
    return !isDenied;
  });

  const archivePath = resolve(outDir, fileName);
  const tar = (await import('tar')) as unknown as TarLike;
  await tar.create({ file: archivePath, cwd: root }, files);

  return archivePath;
};
