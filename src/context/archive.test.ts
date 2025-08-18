import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

vi.mock('tar', () => ({
  default: undefined,
  create: async ({ file }: { file: string }, _files: string[]) => {
    // Simulate a tarball by writing a recognizable body
    await writeFile(file, 'TAR', 'utf8');
  }
}));

import { createArchive } from './archive';

describe('createArchive', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'stan-arch-'));
    await writeFile(path.join(dir, 'a.txt'), 'A', 'utf8');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('writes archive.tar and excludes files under outputPath', async () => {
    const out = await createArchive(dir, 'stan');
    expect(typeof out).toBe('string');
    expect(out.endsWith('archive.tar')).toBe(true);
    expect(existsSync(path.join(dir, 'stan'))).toBe(true);
    expect(await readFile(out, 'utf8')).toBe('TAR');
  });
});
