import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Writable } from 'node:stream';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ContextConfig } from '@/stan/config';
import { runSelected } from '@/stan/run';

describe('runSelected --ding terminal bell', () => {
  let dir: string;
  // Spy on Writable.write (stdout conforms), keeping types simple and TS-safe.
  let writeSpy: ReturnType<typeof vi.spyOn<Writable, 'write'>>;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'stan-ding-'));
    writeSpy = vi
      .spyOn(process.stdout as unknown as Writable, 'write')
      .mockReturnValue(true);
  });

  afterEach(async () => {
    writeSpy.mockRestore();
    await rm(dir, { recursive: true, force: true });
  });

  it('writes ASCII BEL when behavior.ding is true', async () => {
    const cfg: ContextConfig = {
      stanPath: 'out',
      scripts: {}, // minimal; no scripts/archives needed to test bell
    };
    await runSelected(dir, cfg, [], 'concurrent', {
      archive: false,
      ding: true,
    });
    const calls = writeSpy.mock.calls.map((c) => String(c[0]));
    expect(calls.some((s) => s.includes('\x07'))).toBe(true);
  });
});
