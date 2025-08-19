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
 *
 * NEW REQUIREMENTS:
 * - Maintain a previous full archive copy at <outputPath>/.diff/archive.prev.tar:
 *   - Before writing a new archive, if <outputPath>/archive.tar exists, copy it to .diff/archive.prev.tar.
 *   - After writing a new archive, if .diff/archive.prev.tar does not exist (first run), copy the new archive to .diff/archive.prev.tar.
 */
import { existsSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
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
  await mkdir(outDir, { recursive: true });

  const diffDir = resolve(outDir, '.diff');
  await mkdir(diffDir, { recursive: true });

  const all = await listFiles(cwd);
  const files = await filterFiles(all, {
    cwd,
    outputPath,
    includeOutputDir,
    includes,
    excludes,
  });

  const archivePath = resolve(outDir, fileName);
  const prevPath = resolve(diffDir, 'archive.prev.tar');

  // If an old archive exists (e.g., keep===true), copy it to prev before overwriting.
  if (existsSync(archivePath)) {
    try {
      await copyFile(archivePath, prevPath);
    } catch {
      // ignore copy errors
    }
  }

  // Dynamic import across package boundary; local type TarLike narrows to the
  // subset we need. Cast justified and localized at the boundary.
  const tar = (await import('tar')) as unknown as TarLike;
  await tar.create({ file: archivePath, cwd }, files);

  // Ensure prev exists on first run.
  if (!existsSync(prevPath)) {
    try {
      await copyFile(archivePath, prevPath);
    } catch {
      // ignore copy errors
    }
  }

  return archivePath;
};
