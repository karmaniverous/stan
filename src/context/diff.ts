/**
 * @file src/context/diff.ts
 * Diff helpers for the stan tool.
 *
 * NOTE: Global requirements live in /project.stan.md.
 *
 * REQUIREMENTS (current):
 * - `createArchiveDiff({ cwd, outputPath, baseName })` writes a sentinel file `.stan_no_changes` into the
 *   output directory and creates `<baseName>.diff.tar` containing just that sentinel. Return `{ diffPath }`.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

type TarLike = {
  create: (
    opts: { file: string; cwd?: string },
    files: string[],
  ) => Promise<void>;
};

export const createArchiveDiff = async ({
  cwd,
  outputPath,
  baseName = 'archive',
}: {
  cwd: string;
  outputPath: string;
  baseName?: string;
}): Promise<{ diffPath: string }> => {
  const outDir = resolve(cwd, outputPath);
  await mkdir(outDir, { recursive: true });

  // Always create a tar containing a sentinel file ".stan_no_changes". Tests assert its presence.
  const sentinel = join(outDir, '.stan_no_changes');
  await writeFile(sentinel, 'no changes', 'utf8');

  const diffPath = join(outDir, `${baseName}.diff.tar`);
  const tar = (await import('tar')) as unknown as TarLike;
  await tar.create({ file: diffPath, cwd: outDir }, ['.stan_no_changes']);

  return { diffPath };
};
