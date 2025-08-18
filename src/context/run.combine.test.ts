import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import type { ContextConfig } from './config';
import { runSelected } from './run';

const read = (p: string) => readFile(p, 'utf8');

describe('runSelected combine / sequencing / keep', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'ctx-run-combine-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('when sequential and not enumerated, runs archive last', async () => {
    await writeFile(path.join(dir, 'a.js'), 'process.stdout.write("A")', 'utf8');
    await writeFile(path.join(dir, 'b.js'), 'process.stdout.write("B")', 'utf8');

    const cfg: ContextConfig = {
      outputPath: 'ctx',
      scripts: { a: 'node a.js', b: 'node b.js', archive: 'echo N/A' }
    };
    const created = await runSelected(dir, cfg, null, 'sequential');
    expect(created.includes(path.join(dir, 'ctx', 'archive.tar'))).toBe(true);
  });

  it('combine + archive: writes scripts first, then ONLY combined.tar (includes output dir)', async () => {
    await writeFile(path.join(dir, 'hello.js'), 'process.stdout.write("Hello")', 'utf8');
    const cfg: ContextConfig = {
      outputPath: 'ctx',
      scripts: { hello: 'node hello.js', archive: 'echo N/A' }
    };
    const created = await runSelected(dir, cfg, ['hello', 'archive'], 'concurrent', {
      combine: true
    });
    // combined tar present
    expect(created.some((p) => p.endsWith('combined.tar'))).toBe(true);
    // not writing archive.tar in combine mode
    expect(created.some((p) => p.endsWith('archive.tar'))).toBe(false);
  });

  it('combine without archive: produces combined.txt; clears output by default but keeps with --keep', async () => {
    const cwd = dir;
    const out = path.join(cwd, 'ctx');
    await writeFile(path.join(out, 'old.txt'), 'OLD', 'utf8').catch(() => void 0);

    const cfg: ContextConfig = {
      outputPath: 'ctx',
      scripts: {
        a: 'node -e "process.stdout.write(`A`)"',
        b: 'node -e "process.stdout.write(`B`)"'
      }
    };
    const created1 = await runSelected(cwd, cfg, ['a', 'b'], 'concurrent', { combine: true });
    expect(created1).toContain(path.join(cwd, 'ctx', 'combined.txt'));

    const created2 = await runSelected(cwd, cfg, ['a'], 'concurrent', { combine: true, keep: true });
    expect(created2).toContain(path.join(cwd, 'ctx', 'combined.txt'));

    const combined = await read(path.join(cwd, 'ctx', 'combined.txt'));
    expect(combined).toMatch(/BEGIN \[a]/);
    expect(existsSync(path.join(cwd, 'ctx', 'old.txt'))).toBe(true);
  });
});
