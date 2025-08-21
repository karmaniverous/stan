/* src/stan/archive.ts
 * Create a project archive under the output directory.
 * REQUIREMENTS (updated):
 * - Create <stanPath>/output/archive.tar from project root, excluding node_modules/.git and (by default) stanPath.
 * - Options:
 *   - includeOutputDir?: when true, include the <stanPath>/output directory contents while excluding stanPath/diff and the archive files.
 *   - fileName?: override base name (must end with .tar).
 * - Honor includes/excludes from config (globs supported; includes override excludes).
 * - Return the absolute path to the created tarball.
 * - Maintain previous-archive copy at <stanPath>/diff/archive.prev.tar.
 */
import { existsSync } from 'node:fs';
import { copyFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { classifyForArchive } from './classifier';
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

export type CreateArchiveOptions = {
  includeOutputDir?: boolean;
  fileName?: string;
  includes?: string[];
  excludes?: string[];
};

export const createArchive = async (
  cwd: string,
  stanPath: string,
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

  const { outDir, diffDir } = await ensureOutAndDiff(cwd, stanPath);

  const all = await listFiles(cwd);
  const files = await filterFiles(all, {
    cwd,
    stanPath,
    includeOutputDir,
    includes,
    excludes,
  });

  const archivePath = resolve(outDir, fileName);
  const prevPath = resolve(diffDir, 'archive.prev.tar');
  const warningsPath = resolve(outDir, 'archive.warnings.txt');

  // If an old archive exists in output, copy it to diff before overwriting.
  if (existsSync(archivePath)) {
    try {
      await copyFile(archivePath, prevPath);
    } catch {
      // ignore copy errors
    }
  }

  // Classify prior to archiving:
  // - exclude binaries
  // - flag large text (not excluded)
  const { textFiles, warningsBody } = await classifyForArchive(cwd, files);
  const filesForArchive = textFiles;

  // Emit warnings file, always present and included in archives.
  try {
    await writeFile(warningsPath, warningsBody, 'utf8');
  } catch {
    // best-effort
  }

  // Helper: ensure warnings file is included even when not packing the whole output directory.
  const withWarnings = (relList: string[]): string[] => {
    const warningsRel = `${stanPath.replace(/\\/g, '/')}/output/archive.warnings.txt`;
    return Array.from(new Set([...relList, warningsRel]));
  };

  const tar = (await import('tar')) as unknown as TarLike;

  if (includeOutputDir) {
    // Force-include <stanPath>/output and exclude <stanPath>/diff and archive files.
    const filesToPack = Array.from(
      new Set([...filesForArchive, `${stanPath.replace(/\\/g, '/')}/output`]),
    );
    const isUnder = (prefix: string, p: string): boolean =>
      p === prefix || p.startsWith(`${prefix}/`);

    await tar.create(
      {
        file: archivePath,
        cwd,
        filter: (p: string) =>
          !(
            isUnder(`${stanPath}/diff`, p) ||
            p === `${stanPath}/output/archive.tar` ||
            p === `${stanPath}/output/archive.diff.tar`
          ),
      },
      filesToPack,
    );
  } else {
    await tar.create({ file: archivePath, cwd }, withWarnings(filesForArchive));
  }

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
