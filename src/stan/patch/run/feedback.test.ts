import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock envelope builder and clipboard copier
vi.mock('../feedback', () => ({
  __esModule: true,
  buildFeedbackEnvelope: (e: unknown) => JSON.stringify({ MOCK: true, e }),
  copyToClipboard: async (_t: string) => {},
}));

import { persistFeedbackAndClipboard } from './feedback';

describe('persistFeedbackAndClipboard', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'stan-fb-'));
    await writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: 'pkg' }), 'utf8');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('writes feedback.txt and logs actions', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const p = await persistFeedbackAndClipboard({
      cwd: dir,
      stanPath: '.stan',
      patchAbs: path.join(dir, '.stan', 'patch', '.patch'),
      cleaned: 'CLEAN',
      parsed: null,
      result: { ok: false, tried: ['t'], lastCode: 1, captures: [] },
      js: { okFiles: [], failed: [], sandboxRoot: null },
      changedFromHeaders: ['x.ts'],
      check: false,
    });

    expect(p && p.endsWith('feedback.txt')).toBe(true);
    const body = await readFile(p as string, 'utf8');
    expect(body.includes('"MOCK":true')).toBe(true);

    const logs = logSpy.mock.calls.map((c) => String(c[0]));
    expect(logs.some((l) => /wrote patch feedback/i.test(l))).toBe(true);
    expect(logs.some((l) => /copied patch feedback/i.test(l))).toBe(true);

    logSpy.mockRestore();
  });
});
