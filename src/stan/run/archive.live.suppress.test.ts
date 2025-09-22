import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ContextConfig } from '@/stan/config';
import { runSelected } from '@/stan/run';

// Light tar mock to avoid heavy operations
vi.mock('tar', () => ({
  __esModule: true,
  default: undefined,
  create: async ({ file }: { file: string }) => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(file, 'TAR', 'utf8');
  },
}));

describe('archivePhase live mode: suppress legacy console logs', () => {
  let dir: string;
  const ttyBackup = (process.stdout as unknown as { isTTY?: boolean }).isTTY;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'stan-arch-live-'));
    // Simulate TTY for live renderer enablement
    try {
      (process.stdout as unknown as { isTTY?: boolean }).isTTY = true;
    } catch {
      // best-effort
    }
  });

  afterEach(async () => {
    try {
      (process.stdout as unknown as { isTTY?: boolean }).isTTY = ttyBackup;
    } catch {
      // ignore
    }
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('does not print "stan: start/done" archive lines under live', async () => {
    const cfg: ContextConfig = {
      stanPath: 'stan',
      scripts: { hello: 'node hello.js' },
    };
    await writeFile(
      path.join(dir, 'hello.js'),
      'process.stdout.write("Hello");',
      'utf8',
    );

    const logs: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((m: unknown) => {
      logs.push(String(m));
    });

    await runSelected(dir, cfg, ['hello'], 'concurrent', {
      archive: true,
      live: true,
    });

    logSpy.mockRestore();

    // Run plan is still printed
    expect(logs.some((l) => /STAN run plan/.test(l))).toBe(true);
    // Legacy archive lines are suppressed during live progress rendering
    expect(logs.some((l) => /stan:\s*start\s*"archive/.test(l))).toBe(false);
    expect(logs.some((l) => /stan:\s*done\s*"archive/.test(l))).toBe(false);
    expect(logs.some((l) => /stan:\s*start\s*"archive \(diff\)"/.test(l))).toBe(
      false,
    );
    expect(logs.some((l) => /stan:\s*done\s*"archive \(diff\)"/.test(l))).toBe(
      false,
    );
  });
});
