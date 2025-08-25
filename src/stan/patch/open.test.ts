import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock spawn before importing the module under test
const calls: string[] = [];
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    __esModule: true,
    ...actual,
    default: actual as unknown as object,
    spawn: (cmdLine: string) => {
      calls.push(cmdLine);
      // Minimal child process stub with unref()
      return {
        unref() {},
      } as unknown as import('node:child_process').ChildProcess;
    },
  };
});

import { openFilesInEditor } from './open';

describe('openFilesInEditor — spawn behavior and guards', () => {
  let dir: string;
  const envBackup = { ...process.env };

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'stan-open-'));
    process.env.STAN_BORING = '1'; // stable logs (no color)
  });

  afterEach(async () => {
    process.env = { ...envBackup };
    calls.length = 0;
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('logs when no open command is configured', async () => {
    const rel = 'a.ts';
    await writeFile(path.join(dir, rel), 'export {};\n', 'utf8');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    openFilesInEditor({ cwd: dir, files: [rel], openCommand: undefined });

    const logs = logSpy.mock.calls.map((c) => String(c[0]));
    expect(logs.some((l) => /no open command configured/i.test(l))).toBe(true);
    expect(calls.length).toBe(0);
  });

  it('skips deleted files and spawns once for existing file when forced in tests', async () => {
    const existing = 'b.ts';
    await writeFile(path.join(dir, existing), 'export const x=1;\n', 'utf8');
    const missing = 'missing.ts';

    process.env.STAN_FORCE_OPEN = '1'; // allow spawn under NODE_ENV=test
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    openFilesInEditor({
      cwd: dir,
      files: [existing, missing],
      openCommand: 'code -g {file}',
    });

    // One spawn for existing file only
    expect(calls.length).toBe(1);
    expect(calls[0]).toContain(existing);

    const logs = logSpy.mock.calls.map((c) => String(c[0]));
    expect(
      logs.some((l) =>
        new RegExp(
          `open\\s*->\\s*.*${existing.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}`,
        ).test(l),
      ),
    ).toBe(true);
  });
});
