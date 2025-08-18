import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// We will mock the internals the CLI wires up.
vi.mock('../../context/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../context/config')>();
  return {
    ...actual,
    findConfigPathSync: vi.fn().mockReturnValue('ctx.config.yml'),
    loadConfig: vi.fn().mockResolvedValue({ outputPath: 'ctx', scripts: { test: 'echo test', lint: 'echo lint' } }),
  };
});

const runSelectedSpy = vi.fn<(...args: unknown[]) => Promise<string[]>>().mockResolvedValue([]);
vi.mock('../../context/run', async () => {
  return {
    runSelected: (...args: unknown[]) => runSelectedSpy(...args),
  };
});

describe('CLI root command', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'ctx-cli-'));
    await writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 'x', version: '0.0.0' }), 'utf8');
  });

  afterEach(async () => {
    runSelectedSpy.mockReset();
    await rm(tmp, { recursive: true, force: true });
  });

  it('passes -e to exclude and treats args as exclusion set', async () => {
    const { buildCli } = await import('./index');
    const cli = await buildCli();
    await cli.parseAsync(['node', 'ctx', '-e', 'archive', 'test'], { from: 'user' });

    expect(runSelectedSpy).toHaveBeenCalledTimes(1);
    const [, , selection, mode] = runSelectedSpy.mock.calls[0] as [unknown, unknown, unknown, unknown];
    expect(selection).toEqual({ include: ['archive', 'test'], except: true });
    expect(mode).toBe('concurrent');
  });

  it('passes -s to run sequentially and preserves enumerated order', async () => {
    const { buildCli } = await import('./index');
    const cli = await buildCli();
    await cli.parseAsync(['node', 'ctx', '-s', 'lint', 'test'], { from: 'user' });
    expect(runSelectedSpy).toHaveBeenCalledTimes(1);
    const [, , selection, mode] = runSelectedSpy.mock.calls[0] as [unknown, unknown, unknown, unknown];
    expect(selection).toEqual({ include: ['lint', 'test'] });
    expect(mode).toBe('sequential');
  });
});
