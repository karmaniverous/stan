import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const runSelectedSpy = vi.fn().mockResolvedValue([]);

vi.mock('@/context/run', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/context/run')>();
  return { ...actual, runSelected: (...args: unknown[]) => runSelectedSpy(...(args as unknown[])) };
});

vi.mock('@/context/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/context/config')>();
  return {
    ...actual,
    findConfigPathSync: vi.fn().mockReturnValue('ctx.config.yml'),
    loadConfig: vi.fn().mockResolvedValue({
      outputPath: 'ctx',
      scripts: { test: 'echo test', lint: 'echo lint' }
    })
  };
});

import { makeCli } from './index';

describe('CLI argument parsing', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'ctx-cli-'));
    process.chdir(dir);
    runSelectedSpy.mockReset();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('passes -e selection with provided keys to runSelected', async () => {
    const cli = makeCli();
    await cli.parseAsync(['node', 'ctx', '-e', 'test'], { from: 'user' });

    const [, , selection, mode] = runSelectedSpy.mock.calls[0];
    expect(selection).toEqual(['lint']); // all except 'test'
    expect(mode).toBe('concurrent');
  });

  it('passes -s to run sequentially and preserves config order', async () => {
    const cli = makeCli();
    await cli.parseAsync(['node', 'ctx', '-s', 'lint', 'test'], { from: 'user' });

    const [, , selection, mode] = runSelectedSpy.mock.calls[0];
    expect(selection).toEqual(['lint', 'test']);
    expect(mode).toBe('sequential');
  });
});
