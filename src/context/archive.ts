import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * @fileoverview Create a project archive under the output directory.
 * NOTE: Global and cross‑cutting requirements live in /requirements.md.
 */

type TarLike = { create: (opts: { file: string }, files: string[]) => Promise<void> };

export type CreateArchiveOptions = {
  /** When true, include the output directory in the tarball even if it is normally excluded. */
  includeOutputDir?: boolean;
  /** Override the output filename. Must end with ".tar". Defaults to "archive.tar". */
  fileName?: string;
};

export type CreateArchiveArgs = {
  cwd: string;
  outputPath: string;
  includeOutputDir?: boolean;
  fileName?: string;
  /** Testing seam: return list of repo‑relative file paths to pack. */
  listFilesFn?: (cwd: string) => Promise<string[]>;
};

const defaultListFiles = async (cwd: string): Promise<string[]> => {
  // Minimal, portable file walker to avoid extra deps.
  const { readdir } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const out: string[] = [];
  const stack: string[] = ['.'];
  while (stack.length) {
    const rel = stack.pop() as string;
    const abs = join(cwd, rel);
    const entries = await readdir(abs, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const childRel = rel === '.' ? e.name : join(rel, e.name);
      if (e.isDirectory()) stack.push(childRel);
      else out.push(childRel);
    }
  }
  out.sort();
  return out;
};

/**
 * Overload: old style API used by some tests and call sites.
 */
export async function createArchive(cwd: string, outputPath: string, options?: CreateArchiveOptions): Promise<string>;
/**
 * Overload: new object‑style API used by archive.test.ts.
 */
export async function createArchive(args: CreateArchiveArgs): Promise<{ archivePath: string; fileCount: number }>;
export async function createArchive(
  ...all: [string, string, CreateArchiveOptions?] | [CreateArchiveArgs]
): Promise<string | { archivePath: string; fileCount: number }> {
  const isObjectStyle = typeof all[0] === 'object';
  const { cwd, outputPath, includeOutputDir, fileName, listFilesFn } = isObjectStyle
    ? (all[0] as CreateArchiveArgs)
    : { cwd: all[0] as string, outputPath: all[1] as string, ...(all[2] ?? {}) };

  const baseName = fileName && fileName.endsWith('.tar') ? fileName : (fileName ? `${fileName}.tar` : 'archive.tar');

  const outDir = path.join(cwd, outputPath);
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });
  const archivePath = path.join(outDir, baseName);

  // Gather files
  const list = (listFilesFn ?? defaultListFiles);
  let files = await list(cwd);

  // Exclude output directory unless explicitly requested.
  if (!includeOutputDir) {
    const prefix = outputPath.replace(/\\/g, '/').replace(/\\+/g, '/');
    files = files.filter((f) => !f.startsWith(prefix + '/'));
  }

  // Create the tarball using (mockable) `tar` package.
  const tar = (await import('tar')) as unknown as TarLike;
  await tar.create({ file: archivePath }, files);

  // Return style depends on input style for backward‑compat.
  if (isObjectStyle) {
    return { archivePath, fileCount: files.length };
  }
  return archivePath;
}
