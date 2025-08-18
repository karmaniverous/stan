import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const runSelectedSpy = vi.fn().mockResolvedValue<string[]>([]);

vi.mock('@/context/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/context/config')>();
  return {
    ...actual,
    findConfigPathSync: vi.fn().mockReturnValue('ctx.config.yml'),
    loadConfig: vi.fn().mockResolvedValue({
      outputPath: 'ctx',
      scripts: { test: 'echo test', lint: 'echo lint' }
    })
  };
});

vi.mock('@/context/run', async () => ({
  runSelected: (...args: unknown[]) => runSelectedSpy(...args)
}));

import { makeCli } from './index';

describe('runner CLI combine flags', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'ctx-cli-combine-'));
    await writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', version: '0.0.0' }), 'utf8');
    process.chdir(dir);
    runSelectedSpy.mockClear();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('maps -c and --combined-file-name', async () => {
    const cli = makeCli();
    await cli.parseAsync(['node', 'ctx', '-c', '--combined-file-name', 'bundle', 'lint'], { from: 'user' });

    const [, , enumerated, behavior] = runSelectedSpy.mock.calls[0];
    expect(enumerated).toEqual(['lint']);
    expect(behavior).toMatchObject({ combine: true, combinedFileName: 'bundle' });
  });
});
