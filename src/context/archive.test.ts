import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

// Mock tar to avoid producing a real archive; capture args.
const createdFiles: string[] = [];
let lastTarOptionsFile: string | undefined;

vi.mock('tar', async () => {
  const fs = await import('node:fs/promises');
  return {
    create: async (opts: { file: string }, files: string[]) => {
      lastTarOptionsFile = opts.file;
      createdFiles.splice(0, createdFiles.length, ...files);
      await fs.writeFile(opts.file, 'TAR'); // create a tiny file
    },
  };
});

// Mock `git ls-files` spawn to return a fixed file set.
vi.mock('node:child_process', async () => {
  const { EventEmitter } = await import('node:events');
  const { PassThrough } = await import('node:stream');

  return {
    spawn: () => {
      const child: any = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();

      // Simulate `git ls-files -z` output with 3 files.
      setImmediate(() => {
        child.stdout.write(['a.txt', 'context/ignore-me.txt', 'b.js'].join('\u0000'));
        child.stdout.end();
        child.emit('close', 0);
      });

      return child;
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

    const { archivePath, fileCount } = await createArchive({
      cwd,
      outputPath: 'context',
    });

    // Check tar.create received the right set (no file under context/).
    expect(createdFiles.sort()).toEqual(['a.txt', 'b.js']);
    expect(fileCount).toBe(2);

    // Check file exists at expected path.
    expect(archivePath).toBe(path.join(cwd, 'context/archive.tar'));
  });
});
