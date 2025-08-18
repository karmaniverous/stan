import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

vi.mock('tar', () => ({
  default: undefined,
  create: async ({ file }: { file: string }) => {
    // The diff helper writes a sentinel `.ctx_no_changes` and then tar.create is called.
    // We simulate a tar by embedding the sentinel name.
    await writeFile(file, '.ctx_no_changes\n', 'utf8');
  }
}));

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

  it('creates archive.diff.tar when --diff and archive is included', async () => {
    const cfg = {
      outputPath: 'out',
      scripts: { test: 'node -e "console.error(123);process.stdout.write(`ok`)"' }
    } as const;

    const created = await runSelected(dir, cfg, ['test', 'archive'], 'concurrent', { diff: true });
    const diffPath = created.find((p) => p.endsWith('archive.diff.tar'));
    expect(diffPath).toBeTruthy();
    const body = await readFile(diffPath as string, 'utf8');
    expect(body.includes('.ctx_no_changes')).toBe(true);
  });

  it('with --combine + --diff: writes combined tar and archive.diff.tar', async () => {
    const cfg = {
      outputPath: 'out',
      scripts: { test: 'node -e "console.error(123);process.stdout.write(`ok`)"' }
    } as const;
    const created = await runSelected(dir, cfg, ['test', 'archive'], 'concurrent', {
      diff: true,
      combine: true
    });
    expect(created.some((p) => p.endsWith('.tar'))).toBe(true);
    const diffPath = created.find((p) => p.endsWith('archive.diff.tar'));
    const body = await readFile(diffPath as string, 'utf8');
    expect(body.includes('.ctx_no_changes')).toBe(true);
  });
});
