/* src/stan/archive.ts
 * Create a project archive under the output directory.
 * NOTE: Global and cross‑cutting requirements live in /stan.project.md.
 *
 * REQUIREMENTS (current):
 * - Create <outputPath>/archive.tar from project root, excluding node_modules/.git and (by default) the outputPath.
 * - Options:
 *   - includeOutputDir?: when true, do include the outputPath directory.
 *   - fileName?: override base name (must end with .tar).
 * - Honor includes/excludes from config (non‑globbing prefixes, includes override excludes).
 * - Respect simple .gitignore entries as prefix excludes (no globbing).
 * - Return the absolute path to the created tarball.
 * - Zero "any" usage.
 */
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { filterFiles, listFiles } from './fs';

type TarLike = {
  create: (
    opts: { file: string; cwd?: string },
    files: string[],
  ) => Promise<void>;
};

export type CreateArchiveOptions = {
  includeOutputDir?: boolean;
  fileName?: string;
  includes?: string[];
  excludes?: string[];
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

  const outDir = resolve(cwd, outputPath);
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });

  const all = await listFiles(cwd);
  const files = await filterFiles(all, {
    cwd,
    outputPath,
    includeOutputDir,
    includes,
    excludes,
  });

  const archivePath = resolve(outDir, fileName);
  const tar = (await import('tar')) as unknown as TarLike;
  await tar.create({ file: archivePath, cwd }, files);

  return archivePath;
};
