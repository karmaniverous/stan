import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

// Capture the file list that tar receives.
const createdFiles: string[] = [];

// Mock tar to avoid real archiving; write a tiny placeholder file.
vi.mock('tar', async () => {
  const fs = await import('node:fs/promises');
  return {
    create: async (opts: { file: string }, files: string[]) => {
      createdFiles.splice(0, createdFiles.length, ...files);
      await fs.writeFile(opts.file, 'TAR');
    },
  };
});

// Proper mock for node:child_process with default export included.
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  const { EventEmitter } = await import('node:events');
  const { PassThrough } = await import('node:stream');

  const spawn: typeof actual.spawn = () => {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const child = Object.assign(new EventEmitter(), {
      stdout,
      stderr,
      pid: 1,
      connected: false,
      kill: () => true,
      send: null,
      stdin: null,
      stdio: [null, stdout, stderr],
      addListener: undefined,
      removeListener: undefined,
    }) as unknown as import('node:child_process').ChildProcessWithoutNullStreams;

    // Simulate `git ls-files -z` with 3 files.
    setImmediate(() => {
      stdout.write(['a.txt', 'context/ignore-me.txt', 'b.js'].join('\u0000'));
      stdout.end();
      (child as any).emit('close', 0);
    });

    return child;
  };

  return { ...actual, default: { ...actual, spawn }, spawn };
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

    // "context/*" excluded
    expect(createdFiles.sort()).toEqual(['a.txt', 'b.js']);
    expect(fileCount).toBe(2);

    // File exists at expected path.
    expect(archivePath).toBe(path.join(cwd, 'context/archive.tar'));
  });
});
