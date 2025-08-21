import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { diagnosePatchWithFs, parseUnifiedDiff } from './parse';

describe('diagnosePatchWithFs (filesystem-backed diagnostics)', () => {
  let dir: string;
  const chToTmp = async () => {
    try {
      process.chdir(os.tmpdir());
    } catch {
      // ignore
    }
  };

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'stan-parse-fs-'));
    try {
      process.chdir(dir);
    } catch {
      // ignore
    }
  });

  afterEach(async () => {
    await chToTmp();
    await rm(dir, { recursive: true, force: true });
  });

  it('reports exists: yes and no path-not-found when file is present', async () => {
    const rel = 'present.txt';
    await writeFile(path.join(dir, rel), 'hello\n', 'utf8');

    const diff = [
      `--- ${rel}`,
      `+++ ${rel}`,
      '@@ -1,1 +1,1 @@',
      '-hello',
      '+world',
      '',
    ].join('\n');

    const parsed = parseUnifiedDiff(diff);
    const diags = diagnosePatchWithFs(dir, parsed);
    expect(diags.length).toBe(1);
    expect(diags[0].file).toBe(rel);
    expect(diags[0].causes.includes('path not found')).toBe(false);
    expect(diags[0].details.some((d) => d.includes('exists: yes'))).toBe(true);
  });

  it('reports path not found and exists: no when file is absent', () => {
    const rel = 'absent.txt';
    const diff = [
      `--- ${rel}`,
      `+++ ${rel}`,
      '@@ -1,1 +1,1 @@',
      '-a',
      '+b',
      '',
    ].join('\n');

    const parsed = parseUnifiedDiff(diff);
    const diags = diagnosePatchWithFs(dir, parsed);
    expect(diags.length).toBe(1);
    expect(diags[0].file).toBe(rel);
    expect(diags[0].causes).toContain('path not found');
    expect(diags[0].details.some((d) => d.includes('exists: no'))).toBe(true);
  });
});
