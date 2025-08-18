import { existsSync } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/**
 * Create a project archive under the output directory.
 *
 * REQUIREMENTS (current):
 * - Create <outputPath>/archive.tar from project root, excluding node_modules/.git and (by default) the outputPath.
 * - Options:
 *   - includeOutputDir?: when true, do include the outputPath directory.
 *   - fileName?: override base name (must end with .tar).
 *   - includes?: additional include prefixes (POSIX-style), applied after defaults.
 *   - excludes?: additional exclude prefixes.
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
  includeOutputDir?: boolean;
  /** Name of the tarball (must end with ".tar"). Defaults to "archive.tar". */
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
  const includeOutputDir = options.includeOutputDir ?? false;
  const includes = options.includes ?? [];
  const excludes = options.excludes ?? [];
  let fileName = options.fileName ?? 'archive.tar';
  if (!fileName.endsWith('.tar')) fileName += '.tar';

  const root = cwd;
  const outDir = resolve(root, outputPath);
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });

  const all = await listFiles(root);
  const files = all.filter((f) => {
    const isUnder = (prefix: string) =>
      f === prefix ||
      f.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`);

    // Exclude node_modules and .git always
    if (isUnder('node_modules') || isUnder('.git')) return false;

    // Exclude outputPath by default
    if (!includeOutputDir && isUnder(outputPath.replace(/\\/g, '/')))
      return false;

    // Apply caller-provided excludes
    if (excludes.some((p) => isUnder(p.replace(/\\/g, '/')))) return false;

    // If includes set, require at least one include to match
    if (includes.length > 0) {
      return includes.some((p) => isUnder(p.replace(/\\/g, '/')));
    }
    return true;
  });

  const archivePath = resolve(outDir, fileName);
  const tar = (await import('tar')) as unknown as TarLike;
  await tar.create({ file: archivePath, cwd: root }, files);

  return archivePath;
};
