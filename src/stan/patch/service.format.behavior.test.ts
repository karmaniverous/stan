// src/stan/patch/service.format.behavior.test.ts
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runPatch } from './service';

const makeRepo = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(tmpdir(), 'stan-svc-format-'));
  const yml = ['stanPath: out', 'scripts: {}'].join('\n');
  await writeFile(path.join(dir, 'stan.config.yml'), yml, 'utf8');
  // Create files mentioned in diffs so jsdiff has targets
  await writeFile(path.join(dir, 'src', 'a.ts'), 'export const a=1;\n', {
    encoding: 'utf8',
    flag: 'w',
  }).catch(async () => {
    await import('node:fs/promises').then(({ mkdir }) =>
      mkdir(path.join(dir, 'src'), { recursive: true }),
    );
    await writeFile(
      path.join(dir, 'src', 'a.ts'),
      'export const a=1;\n',
      'utf8',
    );
  });
  await writeFile(path.join(dir, 'src', 'b.ts'), 'export const b=2;\n', 'utf8');
  return dir;
};

describe('service formatter integration (downstream vs STAN; diff vs file-ops)', () => {
  let dir: string;
  const envBackup = { ...process.env };

  beforeEach(async () => {
    dir = await makeRepo();
    process.chdir(dir);
    process.env = { ...envBackup, STAN_BORING: '1' }; // stable logs
  });

  afterEach(async () => {
    process.env = { ...envBackup };
    try {
      process.chdir(tmpdir());
    } catch {
      // ignore
    }
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('downstream diff: multiple failed files -> one-liners with blank-line separation', async () => {
    // Downstream repo
    vi.spyOn(await import('../version'), 'getVersionInfo').mockResolvedValue({
      packageVersion: '0.0.0-test',
      nodeVersion: process.version,
      repoRoot: dir,
      stanPath: 'out',
      isDevModuleRepo: false,
      systemPrompt: {
        localExists: false,
        baselineExists: false,
        inSync: false,
      },
      docsMeta: null,
    });

    // Force apply failure with jsdiff generic (use headers for targets)
    vi.spyOn(
      await import('./run/pipeline'),
      'applyPatchPipeline',
    ).mockResolvedValue({
      ok: false,
      result: {
        ok: false,
        tried: ['p1', 'p0'],
        lastCode: 1,
        captures: [{ label: 'p0', code: 1, stdout: '', stderr: '' }],
      },
      js: { okFiles: [], failed: [], sandboxRoot: undefined },
    });

    const diff = [
      'diff --git a/src/a.ts b/src/a.ts',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -1,1 +1,1 @@',
      '-export const a=1;',
      '+export const a=10;',
      '',
      'diff --git a/src/b.ts b/src/b.ts',
      '--- a/src/b.ts',
      '+++ b/src/b.ts',
      '@@ -1,1 +1,1 @@',
      '-export const b=2;',
      '+export const b=20;',
      '',
    ].join('\n');

    const logs: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((m: unknown) => {
      logs.push(String(m));
    });

    await runPatch(dir, diff);
    logSpy.mockRestore();

    const body = logs.join('\n');
    const reA = /file src\/a\.ts was invalid/;
    const reB = /file src\/b\.ts was invalid/;
    // Ensure both lines present and separated by a blank line (two newlines between)
    expect(body).toMatch(reA);
    expect(body).toMatch(reB);
    expect(body).toMatch(/invalid\.\n\nThe unified diff patch for file/);
  });

  it('STAN diff: diagnostics envelope uses git stderr when present', async () => {
    // STAN repo
    vi.spyOn(await import('../version'), 'getVersionInfo').mockResolvedValue({
      packageVersion: '0.0.0-test',
      nodeVersion: process.version,
      repoRoot: dir,
      stanPath: 'out',
      isDevModuleRepo: true,
      systemPrompt: {
        localExists: false,
        baselineExists: false,
        inSync: false,
      },
      docsMeta: null,
    });
    // Apply failure with stderr
    vi.spyOn(
      await import('./run/pipeline'),
      'applyPatchPipeline',
    ).mockResolvedValue({
      ok: false,
      result: {
        ok: false,
        tried: ['p1', 'p0'],
        lastCode: 1,
        captures: [
          {
            label: 'p0',
            code: 1,
            stdout: '',
            stderr: 'error: patch failed\nat foo:1',
          },
        ],
      },
      js: { okFiles: [], failed: [], sandboxRoot: undefined },
    });

    const diff = [
      'diff --git a/src/a.ts b/src/a.ts',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -1,1 +1,1 @@',
      '-export const a=1;',
      '+export const a=10;',
      '',
    ].join('\n');

    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((m: unknown) => {
      logs.push(String(m));
    });
    await runPatch(dir, diff);
    spy.mockRestore();
    const body = logs.join('\n');
    expect(body).toMatch(/START PATCH DIAGNOSTICS/);
    expect(body).toMatch(/error: patch failed/);
    expect(body).toMatch(/END PATCH DIAGNOSTICS/);
  });

  it('STAN diff: diagnostics envelope lists jsdiff reasons when stderr empty', async () => {
    vi.spyOn(await import('../version'), 'getVersionInfo').mockResolvedValue({
      packageVersion: '0.0.0-test',
      nodeVersion: process.version,
      repoRoot: dir,
      stanPath: 'out',
      isDevModuleRepo: true,
      systemPrompt: {
        localExists: false,
        baselineExists: false,
        inSync: false,
      },
      docsMeta: null,
    });
    vi.spyOn(
      await import('./run/pipeline'),
      'applyPatchPipeline',
    ).mockResolvedValue({
      ok: false,
      result: {
        ok: false,
        tried: ['p1', 'p0'],
        lastCode: 1,
        captures: [{ label: 'p0', code: 1, stdout: '', stderr: '' }],
      },
      js: {
        okFiles: [],
        failed: [
          { path: 'src/a.ts', reason: 'unable to place hunk(s)' },
          { path: 'src/b.ts', reason: 'target file not found' },
        ],
        sandboxRoot: undefined,
      },
    });

    const diff = [
      'diff --git a/src/a.ts b/src/a.ts',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -1,1 +1,1 @@',
      '-export const a=1;',
      '+export const a=10;',
      '',
    ].join('\n');

    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((m: unknown) => {
      logs.push(String(m));
    });
    await runPatch(dir, diff);
    spy.mockRestore();
    const body = logs.join('\n');
    expect(body).toMatch(/START PATCH DIAGNOSTICS/);
    expect(body).toMatch(/jsdiff: src\/a\.ts: unable to place hunk/);
    expect(body).toMatch(/jsdiff: src\/b\.ts: target file not found/);
    expect(body).toMatch(/END PATCH DIAGNOSTICS/);
  });

  it('STAN file-ops: diagnostics envelope for parse failures (no action line)', async () => {
    vi.spyOn(await import('../version'), 'getVersionInfo').mockResolvedValue({
      packageVersion: '0.0.0-test',
      nodeVersion: process.version,
      repoRoot: dir,
      stanPath: 'out',
      isDevModuleRepo: true,
      systemPrompt: {
        localExists: false,
        baselineExists: false,
        inSync: false,
      },
      docsMeta: null,
    });
    const body = [
      '## UPDATED: ops',
      '',
      '### File Ops',
      'rm /etc/passwd',
      '',
    ].join('\n');
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((m: unknown) => {
      logs.push(String(m));
    });
    await runPatch(dir, body);
    spy.mockRestore();
    const printed = logs.join('\n');
    expect(printed).toMatch(/^The File Ops patch failed\./m);
    expect(printed).toMatch(/START PATCH DIAGNOSTICS/);
    expect(printed).toMatch(/file-ops/);
    expect(printed).toMatch(/END PATCH DIAGNOSTICS/);
    // Ensure downstream action line is not present
    expect(printed).not.toMatch(
      /Perform this operation with unified diff patches/,
    );
  });

  it('STAN diff: diagnostics envelope lists jsdiff reasons even when git attempts have stderr', async () => {
    // STAN repo
    vi.spyOn(await import('../version'), 'getVersionInfo').mockResolvedValue({
      packageVersion: '0.0.0-test',
      nodeVersion: process.version,
      repoRoot: dir,
      stanPath: 'out',
      isDevModuleRepo: true,
      systemPrompt: {
        localExists: false,
        baselineExists: false,
        inSync: false,
      },
      docsMeta: null,
    });
    // Apply failure with stderr and js failures together
    vi.spyOn(
      await import('./run/pipeline'),
      'applyPatchPipeline',
    ).mockResolvedValue({
      ok: false,
      result: {
        ok: false,
        tried: ['p1', 'p0'],
        lastCode: 1,
        captures: [
          {
            label: '3way+nowarn-p1',
            code: 1,
            stdout: '',
            stderr: 'error: patch failed\n',
          },
        ],
      },
      js: {
        okFiles: [],
        failed: [{ path: 'src/a.ts', reason: 'unable to place hunk(s)' }],
        sandboxRoot: undefined,
      },
    });
    const diff = [
      'diff --git a/src/a.ts b/src/a.ts',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -1,1 +1,1 @@',
      '-export const a=1;',
      '+export const a=10;',
      '',
    ].join('\n');
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((m: unknown) => {
      logs.push(String(m));
    });
    await runPatch(dir, diff);
    spy.mockRestore();
    const body = logs.join('\n');
    expect(body).toMatch(/START PATCH DIAGNOSTICS/);
    expect(body).toMatch(/error: patch failed/);
    expect(body).toMatch(/jsdiff:\s*src\/a\.ts: unable to place hunk/);
    expect(body).toMatch(/END PATCH DIAGNOSTICS/);
  });
});
