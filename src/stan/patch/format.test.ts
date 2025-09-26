// src/stan/patch/format.test.ts
import { describe, expect, it } from 'vitest';

import { formatPatchFailure, type JsReason } from './format';

describe('formatPatchFailure (unit coverage: downstream vs STAN; diff vs file-ops)', () => {
  it('downstream diff: one-liners with blank-line separation for multiple targets', () => {
    const out = formatPatchFailure({
      context: 'downstream',
      kind: 'diff',
      targets: ['src/a.ts', 'src/b.ts'],
    });
    // Two lines separated by a blank line and trailing newline
    const parts = out.trimEnd().split('\n\n');
    expect(parts.length).toBe(2);
    expect(parts[0]).toMatch(/file src\/a\.ts was invalid/);
    expect(parts[1]).toMatch(/file src\/b\.ts was invalid/);
    // Ensure final newline present
    expect(out.endsWith('\n')).toBe(true);
  });

  it('STAN diff: diagnostics envelope with verbatim git stderr when present', () => {
    const stderr = 'error: patch failed\nat foo:1';
    const out = formatPatchFailure({
      context: 'stan',
      kind: 'diff',
      targets: ['src/x.ts'],
      gitStderr: stderr,
    });
    expect(out).toMatch(
      /The unified diff patch for file src\/x\.ts was invalid\./,
    );
    expect(out).toMatch(/START PATCH DIAGNOSTICS/);
    expect(out).toContain(stderr);
    expect(out).toMatch(/END PATCH DIAGNOSTICS/);
  });

  it('STAN diff: when git stderr absent, include jsdiff reasons', () => {
    const js: JsReason[] = [
      { path: 'src/y.ts', reason: 'unable to place hunk(s)' },
      { path: 'src/z.ts', reason: 'target file not found' },
    ];
    const out = formatPatchFailure({
      context: 'stan',
      kind: 'diff',
      targets: ['src/y.ts'],
      gitStderr: '',
      jsReasons: js,
    });
    expect(out).toMatch(/START PATCH DIAGNOSTICS/);
    expect(out).toMatch(/jsdiff: src\/y\.ts: unable to place hunk/);
    expect(out).toMatch(/jsdiff: src\/z\.ts: target file not found/);
    expect(out).toMatch(/END PATCH DIAGNOSTICS/);
  });

  it('downstream file-ops: quotes block and requests unified diffs', () => {
    const block = ['### File Ops', 'mv a b', 'rm c'].join('\n');
    const out = formatPatchFailure({
      context: 'downstream',
      kind: 'file-ops',
      fileOpsBlock: block,
    });
    expect(out).toMatch(/The following File Ops patch failed:/);
    expect(out).toContain('mv a b');
    expect(out).toContain('rm c');
    expect(out).toMatch(
      /Perform this operation with unified diff patches instead/,
    );
  });

  it('STAN file-ops: diagnostics envelope with parser/exec lines', () => {
    const errors = [
      'file-ops failed: mv a b — destination exists',
      'file-ops failed: rm c — path does not exist',
    ];
    const out = formatPatchFailure({
      context: 'stan',
      kind: 'file-ops',
      fileOpsErrors: errors,
    });
    expect(out).toMatch(/^The File Ops patch failed\./);
    expect(out).toMatch(/START PATCH DIAGNOSTICS/);
    for (const e of errors) expect(out).toContain(e);
    expect(out).toMatch(/END PATCH DIAGNOSTICS/);
  });
});
