// src/stan/patch.test.ts
import { EventEmitter } from 'node:events';
import path from 'node:path';

import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';

// Mock spawn to avoid running real git; return an EE that closes with code 0.
vi.mock('node:child_process', () => ({
  __esModule: true,
  default: {},
  spawn: () => {
    const ee = new EventEmitter();
    setTimeout(() => ee.emit('close', 0), 0);
    return ee as unknown;
  },
}));

import { registerPatch } from '@/stan/patch';

describe('patch subcommand', () => {
  it('logs normalized repo-root patch path and invokes git apply safely', async () => {
    const cli = new Command();
    registerPatch(cli);

    const cwd = process.cwd();
    const rel = 'foo.patch';
    const absRepoPath = path.join(cwd, rel);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Invoke: stan patch /foo.patch  -> should normalize to <cwd>/foo.patch
    await cli.parseAsync(['node', 'stan', 'patch', '/foo.patch'], {
      from: 'user',
    });

    const logs = logSpy.mock.calls.map((c) => String(c[0]));
    // First visible effect: applying normalized path relative to repo root.
    expect(logs.some((l) => l.includes(`stan: applying patch "${rel}"`))).toBe(
      true,
    );

    // No error thrown; spawn mocked to close with 0 and print "patch applied"
    expect(logs.some((l) => l.includes('stan: patch applied'))).toBe(true);

    logSpy.mockRestore();
  });
});
