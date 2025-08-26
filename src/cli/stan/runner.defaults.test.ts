import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Record calls to runSelected
const recorded: unknown[][] = [];
vi.mock('@/stan/run', () => ({
  __esModule: true,
  runSelected: (...args: unknown[]) => {
    recorded.push(args);
    return Promise.resolve([] as string[]);
  },
}));

import { applyCliSafety } from './cli-utils';
import { registerRun } from './runner';

describe('run defaults from opts.cliDefaults.run', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'stan-run-def-'));
    process.chdir(dir);
    recorded.length = 0;
    const yml = [
      'stanPath: stan',
      'scripts:',
      '  a: echo a',
      '  b: echo b',
      '  c: echo c',
    ].join('\n');
    await writeFile(path.join(dir, 'stan.config.yml'), yml, 'utf8');
  });

  afterEach(async () => {
    try {
      process.chdir(tmpdir());
    } catch {
      // ignore
    }
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('defaults to all scripts when run.scripts=true', async () => {
    await writeFile(
      path.join(dir, 'stan.config.yml'),
      [
        'stanPath: stan',
        'scripts:',
        '  a: echo a',
        '  b: echo b',
        '  c: echo c',
        'opts:',
        '  cliDefaults:',
        '    run:',
        '      scripts: true',
      ].join('\n'),
      'utf8',
    );
    const cli = new Command();
    applyCliSafety(cli);
    registerRun(cli);
    await cli.parseAsync(['node', 'stan', 'run', '-p'], { from: 'user' });
    expect(recorded.length).toBe(0);
    // Plan only; next run validates selection when invoked without -p
    await cli.parseAsync(['node', 'stan', 'run'], { from: 'user' });
    const args = recorded[0];
    const selection = args[2] as string[];
    expect(selection).toEqual(['a', 'b', 'c']);
  });

  it('defaults to [] when run.scripts=false and archive=false from defaults', async () => {
    await writeFile(
      path.join(dir, 'stan.config.yml'),
      [
        'stanPath: stan',
        'scripts:',
        '  a: echo a',
        '  b: echo b',
        'opts:',
        '  cliDefaults:',
        '    run:',
        '      scripts: false',
        '      archive: false',
      ].join('\n'),
      'utf8',
    );
    const cli = new Command();
    applyCliSafety(cli);
    registerRun(cli);
    await cli.parseAsync(['node', 'stan', 'run'], { from: 'user' });
    const args = recorded[0];
    const selection = args[2] as string[];
    const behavior = args[4] as { archive?: boolean };
    expect(selection).toEqual([]);
    expect(behavior.archive).toBe(false);
  });

  it('defaults to intersection when run.scripts=["b"]', async () => {
    await writeFile(
      path.join(dir, 'stan.config.yml'),
      [
        'stanPath: stan',
        'scripts:',
        '  a: echo a',
        '  b: echo b',
        'opts:',
        '  cliDefaults:',
        '    run:',
        '      scripts: ["b"]',
      ].join('\n'),
      'utf8',
    );
    const cli = new Command();
    applyCliSafety(cli);
    registerRun(cli);
    await cli.parseAsync(['node', 'stan', 'run'], { from: 'user' });
    const args = recorded[0];
    expect(args[2] as string[]).toEqual(['b']);
  });
});
