// src/stan/patch.test.ts
import { EventEmitter } from 'node:events';
import path from 'node:path';

import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';

let receivedArgs: unknown[] | null = null;

vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => {
    receivedArgs = args;
    const ee = new EventEmitter();
    // Simulate successful git apply
    setTimeout(() => ee.emit('close', 0), 0);
    return ee as unknown;
  },
}));

import { registerPatch } from '@/stan/patch';

describe('patch subcommand', () => {
  it('normalizes repo-root-anchored path and invokes git apply', async () => {
    const cli = new Command();
    registerPatch(cli);

    const cwd = process.cwd();
    const rel = 'foo.patch';
    const absRepoPath = path.join(cwd, rel);

    // Invoke: stan patch /foo.patch
    await cli.parseAsync(['node', 'stan', 'patch', '/foo.patch'], {
      from: 'user',
    });

    expect(receivedArgs).toBeTruthy();
    const [cmd, argv] = receivedArgs as [string, string[]];

    expect(cmd).toBe('git');
    expect(argv.slice(0, 2)).toEqual(['apply', '--3way']);
    expect(argv[2]).toBe(absRepoPath);
  });
});
