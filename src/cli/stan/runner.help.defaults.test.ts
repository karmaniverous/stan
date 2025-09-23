import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';

import { registerRun } from './runner';

describe('run help shows numeric defaults for hang thresholds', () => {
  it('prints (DEFAULT: Ns) for --hang-warn/--hang-kill/--hang-kill-grace', () => {
    const cli = new Command();
    registerRun(cli);
    const run = cli.commands.find((c) => c.name() === 'run');
    expect(run).toBeTruthy();

    let printed = '';
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: unknown): boolean => {
        printed += String(chunk);
        return true;
      });

    run?.outputHelp();
    spy.mockRestore();

    expect(printed).toMatch(/--hang-warn .*DEFAULT:\s*120s/i);
    expect(printed).toMatch(/--hang-kill .*DEFAULT:\s*300s/i);
    expect(printed).toMatch(/--hang-kill-grace .*DEFAULT:\s*10s/i);
  });
});
