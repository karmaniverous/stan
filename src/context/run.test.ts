import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ContextConfig } from './config';
import { generateWithConfig } from './run';

const read = (p: string) => fs.readFile(p, 'utf8');

describe('script execution', () => {
  it('writes <key>.txt for a single requested script key', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'ctx-run-'));
    const config: ContextConfig = {
      outputPath: 'out',
      scripts: {
        hello: `${process.execPath} -e "process.stdout.write('hi')"`,
      },
    };

    const created = await generateWithConfig(config, { cwd, key: 'hello' });
    const dest = path.join(cwd, 'out/hello.txt');

    expect(created).toContain(dest);
    expect(await read(dest)).toBe('hi');
  });

  it('throws for unknown key', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'ctx-run-'));
    const config: ContextConfig = { outputPath: 'out', scripts: {} };
    await expect(generateWithConfig(config, { cwd, key: 'nope' })).rejects.toThrow(
      /not found/i,
    );
  });
});
