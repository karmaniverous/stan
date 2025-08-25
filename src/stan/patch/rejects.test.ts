import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { listRejFiles, moveRejFilesToPatchWorkspace } from './rejects';

describe('rejects helpers (list/move)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'stan-rejects-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('listRejFiles enumerates .rej recursively excluding .git and node_modules', async () => {
    // a/foo.rej -> should be found
    await mkdir(path.join(dir, 'a'), { recursive: true });
    await writeFile(path.join(dir, 'a', 'foo.rej'), 'rej', 'utf8');
    // .git/baz.rej -> excluded
    await mkdir(path.join(dir, '.git'), { recursive: true });
    await writeFile(path.join(dir, '.git', 'baz.rej'), 'rej', 'utf8');
    // node_modules/x/bar.rej -> excluded
    await mkdir(path.join(dir, 'node_modules', 'x'), { recursive: true });
    await writeFile(
      path.join(dir, 'node_modules', 'x', 'bar.rej'),
      'rej',
      'utf8',
    );
    // normal file without .rej suffix -> ignored
    await writeFile(path.join(dir, 'c', 'none.txt'), 'x', 'utf8').catch(
      () => {},
    );

    const rels = await listRejFiles(dir);
    expect(rels).toEqual(['a/foo.rej']);
  });

  it('moveRejFilesToPatchWorkspace moves files under <stanPath>/patch/rejects/<UTC>/', async () => {
    // Provide a stan.config.yml to resolve stanPath
    const cfg = ['stanPath: stan', 'scripts: {}'].join('\n');
    await writeFile(path.join(dir, 'stan.config.yml'), cfg, 'utf8');

    // Prepare a .rej file to move
    await mkdir(path.join(dir, 'src', 'mod'), { recursive: true });
    const srcRel = path.join('src', 'mod', 'file.rej').replace(/\\/g, '/');
    await writeFile(path.join(dir, srcRel), 'rej', 'utf8');

    const destRootRel = await moveRejFilesToPatchWorkspace(dir, [srcRel]);
    expect(typeof destRootRel).toBe('string');
    expect(destRootRel && destRootRel.length).toBeGreaterThan(0);

    const destAbs = path
      .join(dir, destRootRel as string, srcRel)
      .replace(/\\/g, '/');
    const stat = await (
      await import('node:fs/promises')
    ).readFile(destAbs, 'utf8');
    expect(stat).toBe('rej');
  });
});
