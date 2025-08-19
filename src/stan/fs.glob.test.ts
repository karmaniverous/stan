import { mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { filterFiles, listFiles } from './fs';

describe('filterFiles with glob patterns', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await (
      await import('node:fs/promises')
    ).mkdtemp(path.join(os.tmpdir(), 'stan-fs-glob-'));
    // Make a small tree
    await mkdir(path.join(dir, 'packages', 'app1', '.tsbuild'), {
      recursive: true,
    });
    await mkdir(path.join(dir, 'packages', 'app1', 'src'), { recursive: true });
    await mkdir(path.join(dir, 'services', 'svcA', 'generated'), {
      recursive: true,
    });
    await writeFile(
      path.join(dir, 'packages', 'app1', '.tsbuild', 'state.bin'),
      'x',
      'utf8',
    );
    await writeFile(
      path.join(dir, 'packages', 'app1', 'src', 'index.ts'),
      'ts',
      'utf8',
    );
    await writeFile(
      path.join(dir, 'services', 'svcA', 'generated', 'openapi.ts'),
      '//gen',
      'utf8',
    );
    await writeFile(path.join(dir, 'README.md'), '# readme', 'utf8');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('excludes **/.tsbuild/** and **/generated/** via excludes globs', async () => {
    const all = await listFiles(dir);
    const filtered = await filterFiles(all, {
      cwd: dir,
      outputPath: 'stan',
      includeOutputDir: false,
      excludes: ['**/.tsbuild/**', '**/generated/**'],
    });

    const hasTsbuild = filtered.some((f) => f.includes('/.tsbuild/'));
    const hasGenerated = filtered.some((f) => f.includes('/generated/'));
    expect(hasTsbuild).toBe(false);
    expect(hasGenerated).toBe(false);

    // Sanity check: keep src and README.md
    expect(filtered).toEqual(
      expect.arrayContaining(['packages/app1/src/index.ts', 'README.md']),
    );
  });

  it('includes allow-list globs when includes are provided', async () => {
    const all = await listFiles(dir);
    const filtered = await filterFiles(all, {
      cwd: dir,
      outputPath: 'stan',
      includeOutputDir: false,
      includes: ['**/*.md'],
    });
    expect(filtered).toEqual(['README.md']);
  });
});
