/**
 * REQUIREMENTS (current):
 * - Execute configured scripts under ContextConfig in either 'concurrent' or 'sequential' mode.
 * - Create per-script artifacts <outputPath>/<key>.txt combining stdout+stderr.
 * - Maintain <outputPath>/order.txt by appending the UPPERCASE first letter of each executed key, in run order.
 * - Support selection of keys; when null/undefined, run all. Ignore unknown keys.
 * - Treat special key 'archive': it should execute *after* all other keys when present.
 * - Options:
 *   - combine=false|true: if true, produce either `combined.txt` (when `archive` not included) or `combined.tar` (when `archive` is included).
 *   - keep=false|true: when false (default) clear output dir before running; when true, keep prior artifacts.
 *   - diff=false|true: when true and 'archive' is included, also create `archive.diff.tar` in the output dir.
 *   - combinedFileName?: custom base name for combined artifacts (default 'combined').
 * - Log `stan: start "<key>"` and `stan: done "<key>" -> <relative path>` for each artifact including archive variants.
 * - Zero `any` usage; path alias `@/*` is used for intra-project imports.
 */
import { spawn } from 'node:child_process';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { relative, resolve } from 'node:path';

import type { ContextConfig } from '@/stan/config';
import { ensureOutputDir } from '@/stan/config';
import { createArchive } from '@/stan/archive';
import { createArchiveDiff } from '@/stan/diff';

export type Selection = string[] | null;
export type ExecutionMode = 'concurrent' | 'sequential';
export type RunBehavior = {
  combine?: boolean;
  keep?: boolean;
  diff?: boolean;
  combinedFileName?: string;
};

/** Convert an absolute path to a path relative to cwd, with POSIX separators for logs. */
const relForLog = (cwd: string, absPath: string): string =>
  relative(cwd, absPath).replace(/\\/g, '/');

const configOrder = (config: ContextConfig): string[] =>
  Object.keys(config.scripts);

/** Normalize selection to a list of known keys (order preserved). */
const normalizeSelection = (
  selection: Selection | undefined | null,
  config: ContextConfig,
): string[] => {
  const all = configOrder(config);
  if (!selection || selection.length === 0) return all;
  // Filter to known keys only (preserve provided order)
  const set = new Set(all);
  return selection.filter((k) => set.has(k));
};

/** Execute one script and write its combined stdout+stderr to <outRel>/<key>.txt. */
const runOne = async (
  cwd: string,
  outRel: string,
  key: string,
  cmd: string,
  orderFile: string,
): Promise<string> => {
  console.log(`stan: start "${key}"`);
  const outAbs = resolve(cwd, outRel);
  const outFile = resolve(outAbs, `${key}.txt`);
  const stream = createWriteStream(outFile, { encoding: 'utf8' });
  const [file, ...args] = cmd.split(' ');
  const child = spawn(file, args, { cwd, shell: process.platform === 'win32' });
  child.stdout.on('data', (d: Buffer) => {
    stream.write(d);
  });
  child.stderr.on('data', (d: Buffer) => {
    stream.write(d);
  });
  await new Promise<void>((resolveP, rejectP) => {
    child.on('error', rejectP);
    child.on('close', () => resolveP());
  });
  stream.end();
  await appendFile(orderFile, key.slice(0, 1).toUpperCase(), 'utf8');
  console.log(`stan: done "${key}" -> ${relForLog(cwd, outFile)}`);
  return outFile;
};

/** Create a combined text output based on ordered keys. */
const combineTextOutputs = async (
  cwd: string,
  outRel: string,
  keys: string[],
  baseName: string,
): Promise<string> => {
  const outAbs = resolve(cwd, outRel);
  const combinedPath = resolve(outAbs, `${baseName}.txt`);
  const sections: string[] = [];
  for (const k of keys) {
    const p = resolve(outAbs, `${k}.txt`);
    const body = await readFile(p, 'utf8').catch(() => '');
    sections.push(`BEGIN [${k}]`);
    sections.push(body);
    sections.push(`END [${k}]`);
  }
  await writeFile(combinedPath, sections.join('\n'), 'utf8');
  return combinedPath;
};

/**
 * Run the selected scripts and create optional archive/combined artifacts.
 * @returns absolute paths to artifacts created (in creation order).
 */
export const runSelected = async (
  cwd: string,
  config: ContextConfig,
  selection: Selection = null,
  mode: ExecutionMode = 'concurrent',
  behaviorMaybe?: RunBehavior,
): Promise<string[]> => {
  const behavior: RunBehavior = behaviorMaybe ?? {};
  const outRel = config.outputPath;
  const outAbs = await ensureOutputDir(cwd, outRel, Boolean(behavior.keep)); // req: keep semantics
  const orderFile = resolve(outAbs, 'order.txt');
  if (!behavior.keep) await writeFile(orderFile, '', 'utf8');

  const keys = normalizeSelection(selection, config);
  if (keys.length === 0) return [];
  const hasArchive = keys.includes('archive');

  // req: 'archive' must run last if present
  const keysWithoutArchive = keys.filter((k) => k !== 'archive');

  // req: in sequential mode, execution must follow config order regardless of enumeration
  const toRun =
    mode === 'sequential'
      ? configOrder(config).filter((k) => keysWithoutArchive.includes(k))
      : keysWithoutArchive;

  const created: string[] = [];
  const runner = async (k: string): Promise<void> => {
    const p = await runOne(cwd, outRel, k, config.scripts[k], orderFile);
    created.push(p);
  };

  if (mode === 'sequential') {
    for (const k of toRun) {
      await runner(k);
    }
  } else {
    await Promise.all(toRun.map((k) => runner(k)));
  }

  // req: combine behavior - combined.txt (no archive) or combined.tar (with archive)
  if (behavior.combine) {
    const base = behavior.combinedFileName ?? 'combined';
    if (hasArchive) {
      const tarPath = resolve(outAbs, `${base}.tar`);
      const tar = (await import('tar')) as unknown as {
        create: (
          opts: { file: string; cwd?: string },
          files: string[],
        ) => Promise<void>;
      };
      await tar.create({ file: tarPath, cwd }, [outRel]);
      created.push(tarPath);
    } else {
      const p = await combineTextOutputs(cwd, outRel, toRun, base);
      created.push(p);
    }
  }

  // req: when not combining, create archive.tar if 'archive' included
  if (hasArchive && !behavior.combine) {
    console.log('stan: start "archive"');
    const archivePath = await createArchive(cwd, outRel);
    console.log(`stan: done "archive" -> ${relForLog(cwd, archivePath)}`);
    created.push(archivePath);

    // req: --diff creates archive.diff.tar as well
    if (behavior.diff) {
      console.log('stan: start "archive (diff)"');
      const { diffPath } = await createArchiveDiff({
        cwd,
        outputPath: outRel,
        baseName: 'archive',
      });
      console.log(`stan: done "archive (diff)" -> ${relForLog(cwd, diffPath)}`);
      created.push(diffPath);
    }
  }

  // req: when combining with archive, still honor --diff after combined tar is created
  if (hasArchive && behavior.combine && behavior.diff) {
    console.log('stan: start "archive (diff)"');
    const { diffPath } = await createArchiveDiff({
      cwd,
      outputPath: outRel,
      baseName: 'archive',
    });
    console.log(`stan: done "archive (diff)" -> ${relForLog(cwd, diffPath)}`);
    created.push(diffPath);
  }

  return created;
};
