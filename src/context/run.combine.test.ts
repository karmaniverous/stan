import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { createArchive } from './archive';
import type { CtxConfig } from './config';
import { runSelected } from './run';

// Spy createArchive so we can assert options without invoking "tar".
vi.mock('./archive', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./archive')>();
  return {
    ...actual,
    createArchive: vi.fn(async (cwd: string, outputPath: string, opts?: { includeOutputDir?: boolean; fileName?: string }) => {
      const fileName = opts?.fileName ?? 'archive.tar';
      const dest = path.join(cwd, outputPath, fileName);
      await writeFile(dest, `ARCHIVE(${fileName}) includeOut=${Boolean(opts?.includeOutputDir)}`, 'utf8');
      return dest;
    }),
  };
});

const mkTmp = async (): Promise<string> => await mkdtemp(path.join(os.tmpdir(), 'ctx-run-combine-'));
const cleanup = async (dir: string): Promise<void> => { await rm(dir, { recursive: true, force: true }); };
const read = async (p: string): Promise<string> => (await readFile(p, 'utf8')).trim();

describe('runSelected combine / sequencing / keep', () => {
  it('when sequential and not enumerated, runs archive last', async () => {
    const dir = await mkTmp();
    try {
      await writeFile(path.join(dir, 'a.js'), "const fs=require('fs'); fs.appendFileSync('order.txt','A');", 'utf8');
      await writeFile(path.join(dir, 'b.js'), "const fs=require('fs'); fs.appendFileSync('order.txt','B');", 'utf8');

      const cfg: CtxConfig = { outputPath: 'ctx', scripts: { a: 'node a.js', b: 'node b.js' } };
      await runSelected(dir, cfg, undefined, 'sequential'); // run everything

      const order = await read(path.join(dir, 'order.txt'));
      expect(order).toBe('AB');
      expect(existsSync(path.join(dir, 'ctx', 'archive.tar'))).toBe(true);
    } finally {
      await cleanup(dir);
    }
  });

  it('combine + archive: writes scripts first, then ONLY combined.tar (includes output dir)', async () => {
    const dir = await mkTmp();
    try {
      await writeFile(path.join(dir, 'hello.js'), "require('fs').writeFileSync('ok','1')", 'utf8');

      const cfg: CtxConfig & { combinedFileName?: string } = {
        outputPath: 'ctx',
        scripts: { hello: 'node hello.js' },
        combinedFileName: 'myFile',
      };

      const created = await runSelected(dir, cfg, undefined, 'concurrent', { combine: true });

      // combined tar present
      expect(created).toContain(path.join(dir, 'ctx', 'myFile.tar'));
      // standard archive.tar is NOT created under --combine+archive
      expect(created).not.toContain(path.join(dir, 'ctx', 'archive.tar'));
      expect(existsSync(path.join(dir, 'ctx', 'archive.tar'))).toBe(false);

      // createArchive call used includeOutputDir: true and the custom fileName
      const calls = (createArchive as unknown as ReturnType<typeof vi.fn>).mock.calls;
      const onlyCall = calls.find(([, , opts]) => opts?.fileName === 'myFile.tar');
      expect(onlyCall?.[2]?.includeOutputDir).toBe(true);
    } finally {
      await cleanup(dir);
    }
  });

  it('combine without archive: produces combined.txt with headers; clears output by default but keeps with --keep', async () => {
    const dir = await mkTmp();
    try {
      const outDir = path.join(dir, 'ctx');
      await rm(outDir, { recursive: true, force: true });
      await mkdtemp(outDir).catch(() => void 0);
      await writeFile(path.join(outDir, 'old.txt'), 'old', 'utf8');

      await writeFile(path.join(dir, 'a.js'), "console.log('OUT A')", 'utf8');
      await writeFile(path.join(dir, 'b.js'), "console.error('ERR B')", 'utf8');

      const cfg: CtxConfig & { combinedFileName?: string } = {
        outputPath: 'ctx',
        combinedFileName: 'combo',
        scripts: { a: 'node a.js', b: 'node b.js' },
      };

      // Run combine over only a,b (no archive). Default clears outDir.
      const created1 = await runSelected(dir, cfg, { include: ['a', 'b'] }, 'concurrent', { combine: true });
      expect(created1).toContain(path.join(dir, 'ctx', 'combo.txt'));
      expect(existsSync(path.join(dir, 'ctx', 'old.txt'))).toBe(false);

      const combined = await read(path.join(dir, 'ctx', 'combo.txt'));
      expect(combined).toMatch(/BEGIN \[a]/);
      expect(combined).toMatch(/END \[a]/);
      expect(combined).toMatch(/BEGIN \[b]/);
      expect(combined).toMatch(/END \[b]/);
      expect(combined).toMatch(/OUT A/);
      expect(combined).toMatch(/ERR B/);

      // Now run again with --keep; precreate a marker and ensure it remains.
      await writeFile(path.join(outDir, 'keepme.txt'), 'keep', 'utf8');
      const created2 = await runSelected(dir, cfg, { include: ['a'] }, 'concurrent', { combine: true, keep: true });
      expect(created2).toContain(path.join(dir, 'ctx', 'combo.txt'));
      expect(existsSync(path.join(dir, 'ctx', 'keepme.txt'))).toBe(true);
    } finally {
      await cleanup(dir);
    }
  });
});
