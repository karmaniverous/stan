// src/cli/stan/runner.test.ts
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
      scripts: { test: 'echo test', lint: 'echo lint' },
    }),
  };
});

import { makeCli } from './index';

describe('CLI argument parsing', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'stan-cli-'));
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

  it('passes -e selection with provided keys to runSelected', async () => {
    const cli = makeCli();
    await cli.parseAsync(['node', 'stan', '-e', 'test'], { from: 'user' });

    const [, , selection, mode] = runSelectedSpy.mock.calls[0];
    expect(selection).toEqual(['lint']); // all except 'test'
    expect(mode).toBe('concurrent');
  });

  it('passes -s to run sequentially and preserves config order', async () => {
    const cli = makeCli();
    await cli.parseAsync(['node', 'stan', 'lint', 'test', '-s'], {
      from: 'user',
    });

    const [, , selection, mode] = runSelectedSpy.mock.calls[0];
    expect(selection).toEqual(['lint', 'test']);
    expect(mode).toBe('sequential');
  });
});
