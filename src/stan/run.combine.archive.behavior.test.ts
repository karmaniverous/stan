import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ContextConfig } from './config';
import { runSelected } from './run';

type TarCall = {
  file: string;
  cwd?: string;
  filter?: (p: string, s: unknown) => boolean;
  files: string[];
};

const calls: TarCall[] = [];

// Mock tar.create to capture call arguments for archive.tar and archive.diff.tar
vi.mock('tar', () => ({
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
    // Make an on-disk artifact to satisfy downstream checks
    const { writeFile } = await import('node:fs/promises');
    await writeFile(opts.file, 'TAR', 'utf8');
  },
}));

describe('runSelected combine => regular archive includes output directory', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'stan-run-archive-'));
    calls.length = 0;
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('archive.tar contains files under <outputPath> and patch dir when combine=true', async () => {
    // Prepare a tiny script that writes to stdout so runSelected produces an output file.
    await writeFile(
      path.join(dir, 'hello.js'),
      'process.stdout.write("Hello")',
      'utf8',
    );

    const cfg: ContextConfig = {
      stanPath: 'stan',
      scripts: { hello: 'node hello.js' },
    };

    // Create a patch file under stan/patch to ensure it is included
    await mkdir(path.join(dir, 'stan', 'patch'), { recursive: true });
    await writeFile(path.join(dir, 'stan', 'patch', 'note.txt'), 'p', 'utf8');

    // Run in combine mode so outputs are intended to be included in the regular archive
    await runSelected(dir, cfg, ['hello'], 'concurrent', {
      archive: true,
      combine: true,
    });

    const regCall = calls.find((c) => c.file.endsWith('archive.tar'));
    expect(regCall).toBeTruthy();

    // Ensure files passed to tar for the regular archive include something under the output directory
    expect(regCall?.files.some((p) => p.startsWith('stan/'))).toBe(true);
    // Ensure patch directory is included
    expect(regCall?.files.some((p) => p.startsWith('stan/patch'))).toBe(true);
  });
});
