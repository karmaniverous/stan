// src/stan/help.test.ts
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { renderAvailableScriptsHelp } from './help';

describe('renderAvailableScriptsHelp', () => {
  it('lists script keys from stan.config.yml', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'stan-help-'));
    const yml = [
      'outputPath: stan',
      'scripts:',
      '  test: npm run test',
      '  lint: npm run lint',
    ].join('\n');
    await writeFile(path.join(cwd, 'stan.config.yml'), yml, 'utf8');

    const help = renderAvailableScriptsHelp(cwd);
    expect(help).toMatch(/Available script keys:/);
    expect(help).toMatch(/test, lint/);
    expect(help).toMatch(/stan run test/);
  });
});
