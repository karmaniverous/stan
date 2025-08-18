import { mkdir, mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import type { ContextConfig } from './config';
import { runSelected } from './run';

const write = (p: string, c: string) => writeFile(p, c, 'utf8');
const read = (p: string) => readFile(p, 'utf8');

describe('runSelected combine / sequencing / keep', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'ctx-run-combine-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('when sequential and not enumerated, does not run archive implicitly', async () => {
    const cfg: ContextConfig = {
      outputPath: 'ctx',
      scripts: {
        a: 'node -e "process.stdout.write(`A`)"',
        b: 'node -e "process.stdout.write(`B`)"'
      }
    };
    await runSelected(dir, cfg, null, { sequential: true });
    expect(existsSync(path.join(dir, 'ctx', 'archive.tar'))).toBe(false);
  });

  it('combine + archive: writes scripts first, then ONLY combined.tar (includes output dir)', async () => {
    const cfg: ContextConfig = {
      outputPath: 'ctx',
      scripts: { hello: 'node -e "process.stdout.write(`hi`)"' }
    };
    const created = await runSelected(dir, cfg, ['hello', 'archive'], { combine: true, combinedFileName: 'myFile' });
    expect(created).toContain(path.join(dir, 'ctx', 'myFile.tar'));
    expect(created).not.toContain(path.join(dir, 'ctx', 'archive.tar'));
  });

  it('combine without archive: produces combined.txt with headers; keep preserves previous file', async () => {
    const outDir = path.join(dir, 'ctx');
    await mkdir(outDir, { recursive: true });
    await write(path.join(outDir, 'old.txt'), 'OLD');

    const cfg: ContextConfig = {
      outputPath: 'ctx',
      scripts: {
        a: 'node -e "process.stdout.write(`A`)"',
        b: 'node -e "process.stdout.write(`B`)"'
      }
    };
    const created1 = await runSelected(dir, cfg, ['a', 'b'], { combine: true });
    expect(created1).toContain(path.join(dir, 'ctx', 'combined.txt'));

    const created2 = await runSelected(dir, cfg, ['a'], { combine: true, keep: true });
    expect(created2).toContain(path.join(dir, 'ctx', 'combined.txt'));
    const combined = await read(path.join(dir, 'ctx', 'combined.txt'));
    expect(combined).toMatch(/== a\.txt ==/);
    expect(existsSync(path.join(dir, 'ctx', 'old.txt'))).toBe(true);
  });
});
