import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Spy runSelected to avoid real execution
const runSpy = vi.fn(async () => [] as string[]);
vi.mock('@/stan/run', () => ({
  __esModule: true,
  runSelected: (...args: unknown[]) => runSpy(...args),
}));

import { registerRun } from './runner';

describe('stan run new semantics (default scripts+archive, -p/-S/-A)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'stan-runv2-'));
    // Minimal config with two scripts
    const yml = [
      'stanPath: stan',
      'scripts:',
      '  a: node -e "process.stdout.write(`A`)"',
      '  b: node -e "process.stdout.write(`B`)"',
    ].join('\n');
    await writeFile(path.join(dir, 'stan.config.yml'), yml, 'utf8');
    try {
      process.chdir(dir);
    } catch {
      // ignore
    }
    runSpy.mockReset();
  });

  afterEach(async () => {
    try {
      process.chdir(os.tmpdir());
    } catch {
      // ignore
    }
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('default (no flags): runs all scripts and archives', async () => {
    const cli = new Command();
    registerRun(cli);
    await cli.parseAsync(['node', 'stan', 'run'], { from: 'user' });

    expect(runSpy).toHaveBeenCalledTimes(1);
    const args = runSpy.mock.calls[0] as unknown[];
    // args: (cwd, config, selection, mode, behavior)
    const selection = args[2] as string[];
    const behavior = args[4] as { archive?: boolean };

    expect(selection).toEqual(['a', 'b']);
    expect(behavior.archive).toBe(true);
  });

  it('-p prints plan only and does not call runSelected', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((m: unknown) => {
      logs.push(String(m));
    });

    const cli = new Command();
    registerRun(cli);
    await cli.parseAsync(['node', 'stan', 'run', '-p'], { from: 'user' });

    expect(logs.some((l) => /STAN run plan/i.test(l))).toBe(true);
    expect(runSpy).not.toHaveBeenCalled();
  });

  it('-S -A -> nothing to do; prints plan and exits', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((m: unknown) => {
      logs.push(String(m));
    });

    const cli = new Command();
    registerRun(cli);
    await cli.parseAsync(['node', 'stan', 'run', '-S', '-A'], { from: 'user' });

    expect(logs.some((l) => /nothing to do; plan only/i.test(l))).toBe(true);
    expect(logs.some((l) => /STAN run plan/i.test(l))).toBe(true);
    expect(runSpy).not.toHaveBeenCalled();
  });

  it('-S conflicts with -s / -x (Commander optionConflict)', async () => {
    const cli = new Command();
    registerRun(cli);
    await expect(
      cli.parseAsync(['node', 'stan', 'run', '-S', '-s', 'a'], {
        from: 'user',
      }),
    ).rejects.toMatchObject({ code: 'commander.optionConflict' });
  });

  it('-c conflicts with -A (Commander optionConflict)', async () => {
    const cli = new Command();
    registerRun(cli);
    await expect(
      cli.parseAsync(['node', 'stan', 'run', '-A', '-c'], { from: 'user' }),
    ).rejects.toMatchObject({ code: 'commander.optionConflict' });
  });
});
