import { existsSync } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/**
 * @fileoverview Create a project archive under the output directory.
 * NOTE: Global and cross‑cutting requirements live in /stan.project.md.
 *
 * REQUIREMENTS (current):
 * - Create <outputPath>/archive.tar from project root, excluding node_modules/.git and (by default) the outputPath.
 * - Options:
 *   - includeOutputDir?: when true, do include the outputPath directory.
 *   - fileName?: override base name (must end with .tar).
 * - Return the absolute path to the created tarball.
 * - Zero `any` usage.
 */

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

export const createArchive = async (
  cwd: string,
  outputPath: string,
  options: CreateArchiveOptions = {},
): Promise<string> => {
  let {
    includeOutputDir = false,
    fileName = 'archive.tar',
    includes = [],
    excludes = [],
  } = options;

  if (!fileName.endsWith('.tar')) fileName += '.tar';

  const root = cwd;
  const outDir = resolve(root, outputPath);
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });

  const all = await listFiles(root);
  const files = all.filter((f) => {
    if (f.startsWith('node_modules/') || f.startsWith('.git/')) return false;
    if (!includeOutputDir && f.startsWith(outputPath.replace(/\\/g, '/') + '/'))
      return false;
    const allowByInclude =
      includes && includes.length
        ? includes.some(
            (p) =>
              f === p.replace(/\\/g, '/') ||
              f.startsWith(p.replace(/\\/g, '/') + '/'),
          )
        : true;
    if (!allowByInclude) return false;
    const blockedByExclude =
      excludes && excludes.length
        ? excludes.some(
            (p) =>
              f === p.replace(/\\/g, '/') ||
              f.startsWith(p.replace(/\\/g, '/') + '/'),
          )
        : false;
    if (blockedByExclude) return false;
    return true;
  });

  const archivePath = resolve(outDir, fileName);
  const tar = (await import('tar')) as unknown as TarLike;
  await tar.create({ file: archivePath, cwd: root }, files);

  return archivePath;
};
