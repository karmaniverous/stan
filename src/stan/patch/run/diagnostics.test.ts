import { access, constants, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { writePatchDiagnostics } from './diagnostics';

const exists = async (p: string) => {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

describe('writePatchDiagnostics', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'stan-diag-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes cleaned.patch, attempts.json, and per-attempt logs', async () => {
    const patchAbs = path.join(dir, '.stan', 'patch', '.patch');
    const out = await writePatchDiagnostics({
      cwd: dir,
      patchAbs,
      cleaned: 'CLEANED\n',
      result: {
        ok: false,
        tried: ['t1'],
        lastCode: 1,
        captures: [
          { label: 't1', code: 1, stdout: 'SO', stderr: 'SE' },
          { label: 't2', code: 1, stdout: '', stderr: '' },
        ],
      },
      js: { okFiles: [], failed: [] },
    });

    expect(out.attemptsRel.endsWith('attempts.json')).toBe(true);
    expect(await exists(path.join(dir, out.debugRel, 'cleaned.patch'))).toBe(
      true,
    );

    const attempts = JSON.parse(
      await readFile(path.join(dir, out.attemptsRel), 'utf8'),
    ) as {
      git: Array<{
        label: string;
        code: number;
        stderrBytes: number;
        stdoutBytes: number;
      }>;
      jsdiff: {
        okFiles: string[];
        failedFiles: string[];
        sandboxRoot: string | null;
      };
    };

    expect(attempts.git.length).toBe(2);
    expect(attempts.git[0].label).toBe('t1');
    expect(typeof attempts.git[0].stderrBytes).toBe('number');
    expect(typeof attempts.git[0].stdoutBytes).toBe('number');

    // per-attempt logs exist
    const safe = (s: string) => s.replace(/[^a-z0-9.-]/gi, '_');
    for (const g of attempts.git) {
      expect(
        await exists(
          path.join(dir, out.debugRel, `${safe(g.label)}.stderr.txt`),
        ),
      ).toBe(true);
      expect(
        await exists(
          path.join(dir, out.debugRel, `${safe(g.label)}.stdout.txt`),
        ),
      ).toBe(true);
    }
  });
});
