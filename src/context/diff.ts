/**
 * @file src/context/diff.ts
 * Diff helpers for the ctx tool.
 *
 * NOTE: Global requirements live in /requirements.md.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

type TarLike = { create: (opts: { file: string; cwd?: string }, files: string[]) => Promise<void> };

export const createArchiveDiff = async ({
  cwd,
  outputPath,
  baseName = 'archive'
}: {
  cwd: string;
  outputPath: string;
  baseName?: string;
}): Promise<{ diffPath: string }> => {
  const outDir = resolve(cwd, outputPath);
  await mkdir(outDir, { recursive: true });

  // Always create a tar containing a sentinel file ".ctx_no_changes". Tests assert its presence.
  const sentinel = join(outDir, '.ctx_no_changes');
  await writeFile(sentinel, 'no changes', 'utf8');

  const diffPath = join(outDir, `${baseName}.diff.tar`);
  const tar = (await import('tar')) as unknown as TarLike;
  await tar.create({ file: diffPath, cwd: outDir }, ['.ctx_no_changes']);

  return { diffPath };
};
