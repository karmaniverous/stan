import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const runSelectedSpy = vi.fn().mockResolvedValue<string[]>([]);

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

vi.mock('@/context/run', async () => ({
  runSelected: (...args: unknown[]) => runSelectedSpy(...args)
}));

import { makeCli } from './index';

describe('runner CLI', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'ctx-cli-'));
    await writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', version: '0.0.0' }), 'utf8');
    process.chdir(dir);
    runSelectedSpy.mockClear();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('passes enumerated keys', async () => {
    const cli = makeCli();
    await cli.parseAsync(['node', 'ctx', 'test'], { from: 'user' });

    expect(runSelectedSpy).toHaveBeenCalledTimes(1);
    const [cwd, config, enumerated, behavior] = runSelectedSpy.mock.calls[0];
    expect(cwd).toBe(dir);
    expect(config.outputPath).toBe('ctx');
    expect(enumerated).toEqual(['test']);
    expect(behavior).toMatchObject({ sequential: false, combine: false, keep: false, diff: false });
  });

  it('supports -s and preserves order', async () => {
    const cli = makeCli();
    await cli.parseAsync(['node', 'ctx', '-s', 'lint', 'test'], { from: 'user' });

    const [, , enumerated, behavior] = runSelectedSpy.mock.calls[0];
    expect(enumerated).toEqual(['lint', 'test']);
    expect(behavior.sequential).toBe(true);
  });

  it('supports -e, -c, -k and shows help when nothing created', async () => {
    const cli = makeCli();
    await cli.parseAsync(['node', 'ctx', '-c', '-k', '-e', 'test'], { from: 'user' });

    const [, , enumerated, behavior] = runSelectedSpy.mock.calls[0];
    expect(enumerated).toBeNull();
    expect(behavior).toMatchObject({ combine: true, keep: true, except: ['test'] });
  });
});
