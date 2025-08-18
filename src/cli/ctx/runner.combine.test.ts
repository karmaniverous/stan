import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock config discovery and load.
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

describe('CLI -c/--combine and -k/--keep', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'ctx-cli-combine-'));
    await writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 'x', version: '0.0.0' }), 'utf8');
  });

  afterEach(async () => {
    runSelectedSpy.mockReset();
    await rm(tmp, { recursive: true, force: true });
  });

  it('passes combine and keep flags to the runner (no enumeration)', async () => {
    const { buildCli } = await import('./index');
    const cli = await buildCli();
    await cli.parseAsync(['node', 'ctx', '-c', '-k'], { from: 'user' });

    expect(runSelectedSpy).toHaveBeenCalledTimes(1);
    const [, , selection, mode, behavior] = runSelectedSpy.mock.calls[0] as [unknown, unknown, unknown, unknown, { combine?: boolean; keep?: boolean }];
    expect(selection).toBeUndefined();
    expect(mode).toBe('concurrent');
    expect(behavior?.combine).toBe(true);
    expect(behavior?.keep).toBe(true);
  });

  it('passes -s -c with enumerated keys and except=false', async () => {
    const { buildCli } = await import('./index');
    const cli = await buildCli();
    await cli.parseAsync(['node', 'ctx', '-s', '-c', 'lint', 'test'], { from: 'user' });

    const [, , selection, mode, behavior] = runSelectedSpy.mock.calls[0] as [unknown, unknown, unknown, unknown, { combine?: boolean; keep?: boolean }];
    expect(selection).toEqual({ include: ['lint', 'test'] });
    expect(mode).toBe('sequential');
    expect(behavior?.combine).toBe(true);
  });
});
