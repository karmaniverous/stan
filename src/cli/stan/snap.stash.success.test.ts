import { EventEmitter } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock child_process spawn for stash success in this test file
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    __esModule: true,
    ...actual,
    default: actual as unknown as object,
    spawn: (_cmd: string, args: string[]) => {
      const ee = new EventEmitter();
      // Simulate success for both 'stash -u' and 'stash pop' (code 0)
      const code = 0;
      // Minimal async close to mimic process lifecycle
      setTimeout(() => ee.emit('close', code), 0);
      return ee as unknown;
    },
  };
});

// Mock diff.writeArchiveSnapshot to write a recognizable snapshot body
vi.mock('./diff', () => ({
  __esModule: true,
  writeArchiveSnapshot: async ({
    cwd,
    stanPath,
  }: {
    cwd: string;
    stanPath: string;
  }) => {
    const { mkdir, writeFile } = await import('node:fs/promises');
    const p = path.join(cwd, stanPath, 'diff');
    await mkdir(p, { recursive: true });
    await writeFile(
      path.join(p, '.archive.snapshot.json'),
      JSON.stringify({ ok: true, t: Date.now() }, null, 2),
      'utf8',
    );
  },
}));

// Dynamic loader to ensure our mocks apply before importing CLI code
const loadRegisterSnap = async () => {
  vi.resetModules();
  const mod = await import('@/cli/stan/snap');
  return mod.registerSnap as (cli: Command) => Command;
};

describe('snap CLI (-s) logs stash/pop confirmations on success', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'stan-snap-success-'));
    try {
      process.chdir(dir);
    } catch {
      // ignore
    }
    // Minimal config so snap resolves context and paths
    await writeFile(
      path.join(dir, 'stan.config.yml'),
      ['stanPath: out', 'scripts: {}'].join('\n'),
      'utf8',
    );
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

  it('prints confirmations for stash and pop', async () => {
    const registerSnap = await loadRegisterSnap();
    const cli = new Command();
    registerSnap(cli);
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((m: unknown) => {
      logs.push(String(m));
    });
    await cli.parseAsync(['node', 'stan', 'snap', '-s'], { from: 'user' });
    spy.mockRestore();
    expect(logs.some((l) => /stash saved changes/i.test(l))).toBe(true);
    expect(logs.some((l) => /stash pop restored changes/i.test(l))).toBe(true);
  });
});
