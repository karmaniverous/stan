import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Command } from '@commander-js/extra-typings';
import { describe, expect, it } from 'vitest';

import { deriveScriptsFromPackage, performInit } from './init';

const writeJson = (p: string, v: unknown) => writeFile(p, JSON.stringify(v, null, 2), 'utf8');

describe('init helpers', () => {
  it('deriveScriptsFromPackage picks first \\w+ token and shortest title on duplicates', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'ctx-derive-'));
    await writeJson(path.join(cwd, 'package.json'), {
      scripts: {
        test: 'vitest',
        'test:watch': 'vitest --watch',
        lint: 'eslint .',
        'lint:fix': 'eslint --fix .',
        build: 'rollup -c',
        typecheck: 'tsc --noEmit',
        init: 'echo should-not-appear',
        archive: 'echo nope',
      },
    });

    const derived = await deriveScriptsFromPackage(cwd);
    expect(derived).toEqual({
      test: 'npm run test',
      lint: 'npm run lint',
      build: 'npm run build',
      typecheck: 'npm run typecheck',
    });
  });

  it('performInit --force writes ctx.config.yml with outputPath=ctx, adds to .gitignore', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'ctx-init-'));
    await writeJson(path.join(cwd, 'package.json'), {
      scripts: { test: 'vitest', 'lint:fix': 'eslint --fix .' },
    });

    const cli = new Command().name('ctx');
    const written = await performInit(cli, { cwd, force: true });
    expect(written && written.endsWith('ctx.config.yml')).toBe(true);

    const yml = await readFile(written as string, 'utf8');
    expect(yml).toMatch(/outputPath:\s*ctx/);
    expect(yml).toMatch(/test:\s*npm run test/);
    expect(yml).toMatch(/lint:\s*npm run lint/);

    const gi = await readFile(path.join(cwd, '.gitignore'), 'utf8');
    expect(gi).toMatch(/\/ctx\/\s*$/m);
  });

  it('performInit interactive writes ctx.config.json by defaulting outputPath=ctx and adds to .gitignore when accepted', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'ctx-init-ia-'));
    await writeJson(path.join(cwd, 'package.json'), {
      scripts: { test: 'vitest' },
    });

    const cli = new Command().name('ctx');
    const answers = ['json', /* format */
      '', /* output dir -> defaults to ctx */
      '', /* Add to .gitignore? -> default yes */
    ];
    let i = 0;
    const io = {
      ask: async () => answers[i++] ?? '',
      confirm: async () => true,
    };

    const written = await performInit(cli, { cwd, force: false, io });
    expect(written && written.endsWith('ctx.config.json')).toBe(true);

    const json = await readFile(written as string, 'utf8');
    expect(json).toMatch(/"outputPath":\s*"ctx"/);

    const gi = await readFile(path.join(cwd, '.gitignore'), 'utf8');
    expect(gi).toMatch(/\/ctx\/\s*$/m);
  });
});
