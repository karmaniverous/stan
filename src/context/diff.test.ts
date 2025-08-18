import * as cp from 'node:child_process';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { runSelected } from './run';

describe('diff mode', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'ctx-diff-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  const stubTar = () =>
    vi.spyOn(cp, 'spawn').mockImplementation((cmd, args?: readonly string[], opts?: cp.SpawnOptions) => {
      const ee = new (require('events').EventEmitter)() as unknown as cp.ChildProcess;
      (async () => {
        const idx = (args ?? []).indexOf('-f');
        const rel = (idx >= 0 ? (args as string[])[idx + 1] : 'out/archive.diff.tar')!;
        const dest = path.resolve((opts?.cwd as string) ?? dir, rel);
        await writeFile(dest, '.ctx_no_changes', 'utf8');
        process.nextTick(() => ee.emit('close', 0));
      })();
      return ee;
    });

  it('creates archive.diff.tar when --diff and archive is included', async () => {
    stubTar();
    const cfg = { outputPath: 'out', scripts: { test: 'node -e "process.stdout.write(`ok`)"' } } as const;
    const created = await runSelected(dir, cfg, ['archive'], { diff: true });
    const diffPath = created.find((p) => p.endsWith('archive.diff.tar'));
    expect(typeof diffPath).toBe('string');
    const body = await readFile(diffPath as string, 'utf8');
    expect(body.includes('.ctx_no_changes')).toBe(true);
  });

  it('with --combine + --diff: writes combined tar and archive.diff.tar', async () => {
    stubTar();
    const cfg = { outputPath: 'out', scripts: { test: 'node -e "console.error(123);process.stdout.write(`ok`)"' } } as const;
    const created = await runSelected(dir, cfg, ['test', 'archive'], { diff: true, combine: true });
    expect(created.some((p) => p.endsWith('.tar'))).toBe(true);
    const diffPath = created.find((p) => p.endsWith('archive.diff.tar'));
    const body = await readFile(diffPath as string, 'utf8');
    expect(body.includes('.ctx_no_changes')).toBe(true);
  });
});
