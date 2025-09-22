import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ContextConfig } from '@/stan/config';
import { runSelected } from '@/stan/run';

// Mock tar to avoid heavy operations and ensure archives are written deterministically.
vi.mock('tar', () => ({
  __esModule: true,
  default: undefined,
  create: async ({ file }: { file: string }) => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(file, 'TAR', 'utf8');
  },
}));

describe('live renderer (order + final-frame flush)', () => {
  let dir: string;
  const ttyBackup = (process.stdout as unknown as { isTTY?: boolean }).isTTY;
  const envBackup = { ...process.env };
  // Spy on stdout to capture log-update frames
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'stan-live-order-'));
    try {
      (process.stdout as unknown as { isTTY?: boolean }).isTTY = true;
    } catch {
      // best-effort
    }
    // BORING: ensure stable, colorless labels in assertions
    process.env.STAN_BORING = '1';
    writeSpy = vi
      .spyOn(process.stdout, 'write')
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      .mockImplementation(() => true as unknown as boolean);
  });

  afterEach(async () => {
    try {
      (process.stdout as unknown as { isTTY?: boolean }).isTTY = ttyBackup;
    } catch {
      // ignore
    }
    process.env = { ...envBackup };
    writeSpy.mockRestore();
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('renders scripts first and shows archive:diff in OK state in the final frame', async () => {
    const cfg: ContextConfig = {
      stanPath: 'stan',
      scripts: { hello: 'node -e "process.stdout.write(`Hello`)"' },
    };
    // small script so an output file exists
    await writeFile(
      path.join(dir, 'hello.js'),
      'process.stdout.write("Hello");',
      'utf8',
    );

    await runSelected(dir, cfg, ['hello'], 'concurrent', {
      archive: true,
      live: true,
    });

    // Stitch all writes into a single string for analysis
    const printed = writeSpy.mock.calls.map((c) => String(c[0])).join('');

    // Helper to find the last index of a regex match
    const lastIndexOfRe = (s: string, re: RegExp): number => {
      let idx = -1;
      for (const m of s.matchAll(re)) {
        idx = m.index ?? -1;
      }
      return idx;
    };

    // Row order assertion (BORING labels, table content without ANSI color)
    const idxScript = lastIndexOfRe(printed, /script\s+hello/i);
    const idxFull = lastIndexOfRe(printed, /archive\s+full/i);
    const idxDiff = lastIndexOfRe(printed, /archive\s+diff/i);

    expect(idxScript).toBeGreaterThan(-1);
    expect(idxFull).toBeGreaterThan(-1);
    expect(idxDiff).toBeGreaterThan(-1);
    // Scripts first; archives last (regardless of registration order)
    expect(idxScript).toBeLessThan(idxFull);
    expect(idxScript).toBeLessThan(idxDiff);

    // Final-frame flush assertion:
    // diff row should end in OK (BORING -> "[OK]"), not a running indicator.
    // Look for an "archive  diff" line that contains [OK] later in the buffer.
    const okDiffLineFound =
      lastIndexOfRe(printed, /archive\s+diff[^\n]*\[OK\]/i) > -1;
    expect(okDiffLineFound).toBe(true);
  });
});
