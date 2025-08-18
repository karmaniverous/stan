import * as cp from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { createArchive } from './archive';

describe('createArchive', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'ctx-arch-'));
    await writeFile(path.join(dir, 'a.txt'), 'A', 'utf8');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('writes archive.tar (string path return) and creates output dir', async () => {
    const spawn = vi.spyOn(cp, 'spawn').mockImplementation((cmd, args?: readonly string[], opts?: cp.SpawnOptions) => {
      const ee = new (require('events').EventEmitter)() as unknown as cp.ChildProcess;
      // emulate tar writing the file
      (async () => {
        const idx = (args ?? []).indexOf('-f');
        const rel = (idx >= 0 ? (args as string[])[idx + 1] : 'ctx/archive.tar')!;
        const dest = path.resolve((opts?.cwd as string) ?? dir, rel);
        await mkdir(path.dirname(dest), { recursive: true });
        await writeFile(dest, 'TAR', 'utf8');
        process.nextTick(() => ee.emit('close', 0));
      })();
      return ee;
    });

    const out = await createArchive(dir, 'ctx');
    expect(typeof out).toBe('string');
    expect(out.endsWith('archive.tar')).toBe(true);
    expect(existsSync(path.join(dir, 'ctx'))).toBe(true);
    expect(await readFile(out, 'utf8')).toBe('TAR');

    spawn.mockRestore();
  });
});
