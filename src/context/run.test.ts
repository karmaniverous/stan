import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type CtxConfig } from './config';
import { runSelected } from './run';

const mkTmp = async (): Promise<string> => await mkdtemp(path.join(os.tmpdir(), 'ctx-run-tests-'));
const cleanup = async (dir: string): Promise<void> => { await rm(dir, { recursive: true, force: true }); };

const read = async (p: string): Promise<string> => (await readFile(p, 'utf8')).trim();

describe('script execution', () => {
  let dir: string;

  beforeEach(async () => { dir = await mkTmp(); });
  afterEach(async () => { await cleanup(dir); });

  it('writes <key>.txt for a single requested script key and captures stderr', async () => {
    await writeFile(path.join(dir, 'hello.js'), "console.log('OUT'); console.error('ERR')", 'utf8');
    const cfg: CtxConfig = {
      outputPath: 'out',
      scripts: { hello: 'node hello.js' },
    };

    const created = await runSelected(dir, cfg, { include: ['hello'] }, 'concurrent');
    const dest = path.join(dir, 'out', 'hello.txt');

    expect(created).toContain(dest);
    const contents = await read(dest);
    expect(contents).toMatch(/OUT/);
    expect(contents).toMatch(/ERR/);
  });

  it('runs sequentially in enumerated or config order when --sequential', async () => {
    // Prepare two scripts that append to a shared "order.txt".
    await writeFile(path.join(dir, 'a.js'), "const fs=require('fs'); fs.appendFileSync('order.txt','A');", 'utf8');
    await writeFile(path.join(dir, 'b.js'), "const fs=require('fs'); fs.appendFileSync('order.txt','B');", 'utf8');

    // Case 1: enumerated order
    const cfg1: CtxConfig = { outputPath: 'out', scripts: { a: 'node a.js', b: 'node b.js' } };
    await runSelected(dir, cfg1, { include: ['b', 'a'] }, 'sequential');
    const order1 = await read(path.join(dir, 'order.txt'));
    expect(order1).toBe('BA');

    // Case 2: no explicit include => config order (archive + a + b)
    // Exclude archive to avoid a tarball in the tmp dir; we only want a/b order.
    await writeFile(path.join(dir, 'order.txt'), '', 'utf8'); // reset
    const cfg2: CtxConfig = { outputPath: 'out', scripts: { a: 'node a.js', b: 'node b.js' } };
    await runSelected(dir, cfg2, { include: ['archive'], except: true }, 'sequential');
    const order2 = await read(path.join(dir, 'order.txt'));
    expect(order2).toBe('AB');
  });

  it('throws for unknown key', async () => {
    const cfg: CtxConfig = { outputPath: 'out', scripts: {} };
    await expect(runSelected(dir, cfg, { include: ['nope'] }, 'concurrent')).rejects.toThrow();
  });
});
