import { mkdir,mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('../archive', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./archive')>();
  return {
    ...actual,
    createArchive: async (cwd: string, out: string, opts?: { includeOutputDir?: boolean; fileName?: string }) => {
      const fileName = opts?.fileName ?? 'archive.tar';
      const dest = join(cwd, out, fileName);
      await mkdir(join(cwd, out), { recursive: true });
      await writeFile(dest, 'tar');
      return dest;
    },
  };
});

vi.mock('../diff', async () => {
  return {
    createArchiveDiff: async ({ cwd, outputPath }: { cwd: string; outputPath: string }) => {
      const dest = join(cwd, outputPath, 'archive.diff.tar');
      await mkdir(join(cwd, outputPath), { recursive: true });
      await writeFile(dest, 'diff');
      return { prevCopied: true, diffPath: dest, snapshotPath: join(cwd, outputPath, '.archive.snapshot.json') };
    },
  };
});

import { runSelected } from './run';

describe('diff mode', () => {
  it('creates archive.diff.tar when --diff and archive is included', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'ctx-'));
    const config = {
      outputPath: 'out',
      scripts: {
        test: 'node -e "console.error(123);process.stdout.write(`ok`)"',
        archive: 'tar',
      } as const,
    };

    const created = await runSelected(cwd, config, null, { diff: true, keep: true });
    const diff = created.find((p) => p.endsWith('archive.diff.tar'));
    expect(diff).toBeTruthy();
    const buf = await readFile(diff, 'utf8');
    expect(buf).toBe('diff');
  });

  it('with --combine + --diff: writes combined tar and archive.diff.tar', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'ctx-'));
    const config = {
      outputPath: 'out',
      scripts: {
        test: 'node -e "console.error(123);process.stdout.write(`ok`)"',
        archive: 'tar',
      } as const,
    };

    const created = await runSelected(cwd, config, null, { diff: true, combine: true, keep: true, combinedFileName: 'combined' });
    expect(created.some((p) => p.endsWith('combined.tar'))).toBe(true);
    expect(created.some((p) => p.endsWith('archive.diff.tar'))).toBe(true);

    const diff = created.find((p) => p.endsWith('archive.diff.tar'))!;
    expect(await readFile(diff, 'utf8')).toBe('diff');
  });
});
