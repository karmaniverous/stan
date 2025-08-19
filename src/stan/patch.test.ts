import { EventEmitter } from 'node:events';
import path from 'node:path';

import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';

// Mock spawn to avoid running real git; return an EE that closes with code 0.
// Use vitest-recommended pattern to partially mock a built-in module.
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    __esModule: true,
    ...actual,
    default: actual as unknown as object,
    spawn: () => {
      const ee = new EventEmitter();
      // Simulate success; environments with a real git may still run it,
      // so the test asserts final status (applied|failed), not the exact result.
      setTimeout(() => ee.emit('close', 0), 0);
      return ee as unknown;
    },
  };
});

import { registerPatch } from '@/stan/patch';

describe('patch subcommand', () => {
  it('logs normalized repo-root patch path and emits a terminal status', async () => {
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

    // Terminal status: either applied or failed must be logged.
    const statusLogged = logs.some((l) =>
      /stan:\s+patch\s+(applied|failed)/i.test(l),
    );
    expect(statusLogged).toBe(true);

    logSpy.mockRestore();
  });
});
