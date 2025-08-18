// src/cli/stan/runner.combine.test.ts
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runSelectedSpy = vi.fn().mockResolvedValue([]);

vi.mock('@/stan/run', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stan/run')>();
  return {
    ...actual,
    runSelected: (...args: unknown[]) => runSelectedSpy(...args),
  };
});

vi.mock('@/stan/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stan/config')>();
  return {
    ...actual,
    findConfigPathSync: vi.fn().mockReturnValue('stan.config.yml'),
    loadConfig: vi.fn().mockResolvedValue({
      outputPath: 'stan',
      combinedFileName: 'bundle',
      scripts: { test: 'echo test', lint: 'echo lint' },
    }),
  };
});

import { makeCli } from './index';

describe('CLI -c/--combine and -k/--keep', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'stan-cli-2-'));
    process.chdir(dir);
    runSelectedSpy.mockReset();
  });

  afterEach(async () => {
    // Avoid EBUSY on Windows: change cwd before rm.
    try {
      process.chdir(os.tmpdir());
    } catch {
      // ignore
    }
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('passes combine and keep flags to the runner (no enumeration)', async () => {
    const cli = makeCli();
    await cli.parseAsync(['node', 'stan', '-c', '-k'], { from: 'user' });

    const [, , selection, mode, behavior] = runSelectedSpy.mock.calls[0];
    expect(selection).toBeNull(); // run all
    expect(mode).toBe('concurrent');
    expect(behavior).toMatchObject({ combine: true, keep: true });
  });

  it('honors combinedFileName from config when combining', async () => {
    const cli = makeCli();
    await cli.parseAsync(['node', 'stan', '-c', 'lint'], { from: 'user' });

    const [, , selection, , behavior] = runSelectedSpy.mock.calls[0];
    expect(selection).toEqual(['lint']);
    expect(behavior).toMatchObject({
      combine: true,
      combinedFileName: 'bundle',
    });
  });
});
