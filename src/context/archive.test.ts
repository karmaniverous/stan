import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

// Mock tar to avoid producing a real archive; capture args.
const createdFiles: string[] = [];

vi.mock('tar', async () => {
  const fs = await import('node:fs/promises');
  return {
    create: async (opts: { file: string }, files: string[]) => {
      createdFiles.splice(0, createdFiles.length, ...files);
      await fs.writeFile(opts.file, 'TAR'); // tiny placeholder file
    },
  };
});

import { createArchive } from './archive';

describe('createArchive', () => {
  it('writes archive.tar and excludes files under outputPath', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'ctx-archive-'));
    await mkdir(path.join(cwd, 'context'), { recursive: true });
    await writeFile(path.join(cwd, 'a.txt'), 'A');
    await writeFile(path.join(cwd, 'b.js'), 'B');
    await writeFile(path.join(cwd, 'context/ignore-me.txt'), 'X');

    const fakeList = ['a.txt', 'context/ignore-me.txt', 'b.js'];

    const { archivePath, fileCount } = await createArchive({
      cwd,
      outputPath: 'context',
      listFilesFn: () => Promise.resolve(fakeList), // not `async` (avoids require-await)
    });

    expect(createdFiles.sort()).toEqual(['a.txt', 'b.js']);
    expect(fileCount).toBe(2);
    expect(archivePath).toBe(path.join(cwd, 'context/archive.tar'));
  });
});
