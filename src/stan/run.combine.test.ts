// src/stan/run.combine.test.ts
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ContextConfig } from './config';
import { runSelected } from './run';

const read = (p: string) => readFile(p, 'utf8');

describe('runSelected combine / sequencing / keep', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'stan-run-combine-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('when sequential and not enumerated, runs archive last', async () => {
    await writeFile(
      path.join(dir, 'a.js'),
      'process.stdout.write("A")',
      'utf8',
    );
    await writeFile(
      path.join(dir, 'b.js'),
      'process.stdout.write("B")',
      'utf8',
    );

    const cfg: ContextConfig = {
      outputPath: 'stan',
      scripts: { a: 'node a.js', b: 'node b.js', archive: 'echo N/A' },
    };
    const created = await runSelected(dir, cfg, null, 'sequential');
    expect(created.includes(path.join(dir, 'stan', 'archive.tar'))).toBe(true);
  });

  it('combine + archive: writes scripts first, then ONLY combined.tar (includes output dir)', async () => {
    await writeFile(
      path.join(dir, 'hello.js'),
      'process.stdout.write("Hello")',
      'utf8',
    );
    const cfg: ContextConfig = {
      outputPath: 'stan',
      scripts: { hello: 'node hello.js', archive: 'echo N/A' },
    };
    const created = await runSelected(
      dir,
      cfg,
      ['hello', 'archive'],
      'concurrent',
      {
        combine: true,
      },
    );
    // combined tar present
    expect(created.some((p) => p.endsWith('combined.tar'))).toBe(true);
    // not writing archive.tar in combine mode
    expect(created.some((p) => p.endsWith('archive.tar'))).toBe(false);
  });

  it('combine without archive: produces combined.txt; clears output by default but keeps with --keep', async () => {
    const cwd = dir;

    const cfg: ContextConfig = {
      outputPath: 'stan',
      scripts: {
        a: 'node -e "process.stdout.write(`A`)"',
        b: 'node -e "process.stdout.write(`B`)"',
      },
    };
    // First run clears output directory
    const created1 = await runSelected(cwd, cfg, ['a', 'b'], 'concurrent', {
      combine: true,
    });
    expect(created1).toContain(path.join(cwd, 'stan', 'combined.txt'));

    // Create a pre-existing artifact that should be preserved when --keep is used
    await writeFile(path.join(cwd, 'stan', 'old.txt'), 'OLD', 'utf8');

    const created2 = await runSelected(cwd, cfg, ['a'], 'concurrent', {
      combine: true,
      keep: true,
    });
    expect(created2).toContain(path.join(cwd, 'stan', 'combined.txt'));

    const combined = await read(path.join(cwd, 'stan', 'combined.txt'));
    expect(combined).toMatch(/BEGIN \[a]/);
    expect(existsSync(path.join(cwd, 'stan', 'old.txt'))).toBe(true);
  });
});
