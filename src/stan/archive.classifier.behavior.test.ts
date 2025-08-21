import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createArchive } from './archive';

type TarCall = {
  file: string;
  cwd?: string;
  filter?: (p: string, s: unknown) => boolean;
  files: string[];
};

const calls: TarCall[] = [];

// Mock tar.create to capture call arguments for archive.tar
vi.mock('tar', () => ({
  __esModule: true,
  default: undefined,
  create: async (
    opts: {
      file: string;
      cwd?: string;
      filter?: (p: string, s: unknown) => boolean;
    },
    files: string[],
  ) => {
    calls.push({ file: opts.file, cwd: opts.cwd, filter: opts.filter, files });
    // Write recognizable content to the "archive"
    const { writeFile } = await import('node:fs/promises');
    await writeFile(opts.file, 'TAR', 'utf8');
  },
}));

describe('createArchive integrates classifier (excludes binaries, includes warnings)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'stan-arch-class-'));
    calls.length = 0;
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('non-combine: excludes binaries and includes archive.warnings.txt explicitly', async () => {
    const out = 'out';
    // Prepare a few files in repo root
    await writeFile(
      path.join(dir, 'binary.bin'),
      Buffer.from([0x00, 0x01, 0x02]),
    ); // binary-ish
    await writeFile(path.join(dir, 'small.txt'), 'hello\n', 'utf8');
    const big = Array.from({ length: 3100 }, () => 'x').join('\n') + '\n';
    await writeFile(path.join(dir, 'big.txt'), big, 'utf8');

    await createArchive(dir, out, { includeOutputDir: false });

    const regCall = calls.find((c) => c.file.endsWith('archive.tar'));
    expect(regCall).toBeTruthy();
    const files = regCall?.files ?? [];
    // warnings file included
    expect(files).toEqual(
      expect.arrayContaining([`${out}/output/archive.warnings.txt`]),
    );
    // binary excluded
    expect(files).not.toEqual(expect.arrayContaining(['binary.bin']));
    // text included
    expect(files).toEqual(expect.arrayContaining(['small.txt', 'big.txt']));
  });
});
