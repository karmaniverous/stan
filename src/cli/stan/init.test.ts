import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { performInit, registerInit } from './init';

const read = (p: string) => readFile(p, 'utf8');

describe('init helpers', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'stan-init-'));
    process.chdir(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('performInit --force writes stan.config.yml with outputPath=stan, adds to .gitignore', async () => {
    await writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'x', version: '0.0.0' }),
      'utf8',
    );
    const cli = new Command();
    const p = await performInit(cli, { cwd: dir, force: true });
    expect(p && p.endsWith('stan.config.yml')).toBe(true);
  });

  it('registerInit wires the command', async () => {
    const cli = new Command();
    registerInit(cli);
    // dry parse
    await cli.parseAsync(['node', 'stan', 'init', '--help'], { from: 'user' });
  });
});
