// src/stan/patch.test.ts
import { EventEmitter } from 'node:events';
import path from 'node:path';

import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';

// Properly mock child_process by merging actual module to satisfy ESM expectations.
vi.mock('node:child_process', async (importOriginal) => {
  const actual =
    (await importOriginal()) as typeof import('node:child_process');

  let captured: { cmd: string; args: string[] } | null = null;

  const mockSpawn = (...args: unknown[]) => {
    const [cmd, argv] = args as [string, string[]];
    captured = { cmd, args: argv };
    const ee = new EventEmitter();
    // Simulate successful git apply
    setTimeout(() => ee.emit('close', 0), 0);
    return ee as unknown;
  };

  // Expose a getter for assertions
  // @ts-expect-error test-only export channel
  globalThis.__patchTestCapture__ = () => captured;

  return {
    ...actual,
    spawn: mockSpawn as unknown as typeof actual.spawn,
  };
});

// Import after mocks
import { registerPatch } from '@/stan/patch';

// Helper to read captured spawn args from the mock
const getCaptured = (): { cmd: string; args: string[] } | null => {
  // @ts-expect-error test-only channel
  return typeof globalThis.__patchTestCapture__ === 'function'
    ? // @ts-expect-error test-only channel
      globalThis.__patchTestCapture__()
    : null;
};

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

    const captured = getCaptured();
    expect(captured).toBeTruthy();
    expect(captured?.cmd).toBe('git');
    expect(captured?.args.slice(0, 2)).toEqual(['apply', '--3way']);
    expect(captured?.args[2]).toBe(absRepoPath);
  });
});
