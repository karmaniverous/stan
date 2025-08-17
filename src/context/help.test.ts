import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { renderAvailableScriptsHelp } from './help';

describe('renderAvailableScriptsHelp', () => {
  it('lists script keys from ctx.config.yml', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'ctx-help-'));
    const yml = [
      'outputPath: context',
      'scripts:',
      '  test: npm run test',
      '  lint: npm run lint',
    ].join('\n');
    await writeFile(path.join(cwd, 'ctx.config.yml'), yml, 'utf8');

    const help = renderAvailableScriptsHelp(cwd);
    expect(help).toMatch(/Available script keys:/);
    expect(help).toMatch(/test, lint/);
    expect(help).toMatch(/ctx test/);
  });
});
