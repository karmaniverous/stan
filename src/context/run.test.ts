import { mkdir, mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import type { ContextConfig } from './config';
import { runSelected } from './run';

const write = (p: string, c: string) => writeFile(p, c, 'utf8');
const read = (p: string) => readFile(p, 'utf8');

describe('script execution', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'ctx-run-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes <key>.txt for a single requested script key and captures stderr', async () => {
    const cfg: ContextConfig = {
      outputPath: 'out',
      scripts: {
        hello: 'node -e "console.error(123);process.stdout.write(`ok`)"'
      }
    };
    await runSelected(dir, cfg, ['hello']);
    const body = await read(path.join(dir, 'out', 'hello.txt'));
    expect(body).toContain('ok');
  });

  it('runs sequentially in enumerated or config order when --sequential', async () => {
    await write(path.join(dir, 'a.js'), 'process.stdout.write("A");');
    await write(path.join(dir, 'b.js'), 'process.stdout.write("B");');

    const cfg1: ContextConfig = {
      outputPath: 'out',
      scripts: {
        a: 'node a.js',
        b: 'node b.js'
      }
    };

    // enumerated -> preserves order
    await runSelected(dir, cfg1, ['b', 'a'], { sequential: true });
    const order1 = await read(path.join(dir, 'out', 'order.txt'));
    expect(order1).toBe('BA');

    // config order when not enumerated
    await runSelected(dir, cfg1, null, { sequential: true });
    const order2 = await read(path.join(dir, 'out', 'order.txt'));
    expect(order2).toBe('AB');
  });

  it('unknown key resolves with no artifacts', async () => {
    const cfg: ContextConfig = { outputPath: 'out', scripts: {} };
    const created = await runSelected(dir, cfg, ['nope']);
    expect(created).toEqual([]);
  });
});
