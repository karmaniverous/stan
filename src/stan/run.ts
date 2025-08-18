/* src/stan/run.ts
 * REQUIREMENTS (current):
 * - Execute configured scripts under ContextConfig in either 'concurrent' or 'sequential' mode.
 * - Create per-script artifacts <outputPath>/<key>.txt combining stdout+stderr.
 * - Maintain <outputPath>/order.txt by appending the UPPERCASE first letter of each executed key, in run order.
 *   - ORDER FILE CREATION IS TEST-ONLY: write it when NODE_ENV==='test' or STAN_WRITE_ORDER==='1'.
 * - Support selection of keys; when null/undefined, run all. Ignore unknown keys.
 * - Treat special key 'archive': it should execute after all other keys when present.
 * - Options:
 *   - combine=false|true: if true, produce either combined.txt (when 'archive' not included) or combined.tar (when 'archive' included).
 *   - keep=false|true: when false (default) clear output dir before running; when true, keep prior artifacts.
 *   - diff=false|true: when true and 'archive' is included, also create archive.diff.tar in output dir.
 *   - combinedFileName?: custom base name for combined artifacts (default 'combined').
 * - Log `stan: start "<key>"` and `stan: done "<key>" -> <relative path>` for each artifact including archive variants.
 * - Zero "any" usage; path alias "@/..." is used for intra-project imports.
 *
 * See /stan.project.md for global & cross‑cutting requirements.
 */
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

import { createArchive } from './archive';
import type { ContextConfig } from './config';
import { ensureOutputDir } from './config';
import { createArchiveDiff } from './diff';

export type Selection = string[] | null;
export type ExecutionMode = 'concurrent' | 'sequential';
export type RunBehavior = {
  combine?: boolean;
  keep?: boolean;
  diff?: boolean;
  combinedFileName?: string;
};

const relForLog = (cwd: string, absPath: string): string =>
  relative(cwd, absPath).replace(/\\/g, '/');

const configOrder = (config: ContextConfig): string[] =>
  Object.keys(config.scripts);

/**
 * Normalize selection to config order, preserving special key 'archive' if explicitly requested.
 * - When selection is null/undefined, return all config keys (no 'archive' unless present in config).
 * - When selection exists, order by config order and append 'archive' if present in the selection.
 */
const normalizeSelection = (
  selection: Selection | undefined | null,
  config: ContextConfig,
): string[] => {
  const all = configOrder(config);
  if (!selection || selection.length === 0) return all;

  const requested = new Set(selection);
  const ordered = all.filter((k) => requested.has(k));

  // Preserve explicit request for special 'archive' even though it is not in config.scripts.
  if (requested.has('archive')) ordered.push('archive');

  return ordered;
};

const runOne = async (
  cwd: string,
  outRel: string,
  key: string,
  cmd: string,
  orderFile?: string,
): Promise<string> => {
  console.log(`stan: start "${key}"`);
  const outAbs = resolve(cwd, outRel);
  const outFile = resolve(outAbs, `${key}.txt`);
  const child = spawn(cmd, { cwd, shell: true, windowsHide: true });
  const stream = createWriteStream(outFile, { encoding: 'utf8' });
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
  if (orderFile) {
    await appendFile(orderFile, key.slice(0, 1).toUpperCase(), 'utf8');
  }
  console.log(`stan: done "${key}" -> ${relForLog(cwd, outFile)}`);
  return outFile;
};

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

export const runSelected = async (
  cwd: string,
  config: ContextConfig,
  selection: Selection = null,
  mode: ExecutionMode = 'concurrent',
  behaviorMaybe?: RunBehavior,
): Promise<string[]> => {
  const behavior: RunBehavior = behaviorMaybe ?? {};
  const outRel = config.outputPath;
  const outAbs = await ensureOutputDir(cwd, outRel, Boolean(behavior.keep));

  // Gate order.txt for tests or explicit opt-in.
  const shouldWriteOrder =
    process.env.NODE_ENV === 'test' || process.env.STAN_WRITE_ORDER === '1';

  const orderFile = shouldWriteOrder ? resolve(outAbs, 'order.txt') : undefined;
  if (shouldWriteOrder && !behavior.keep) {
    await writeFile(orderFile as string, '', 'utf8');
  }

  const keys = normalizeSelection(selection, config);
  if (keys.length === 0) return [];
  const hasArchive = keys.includes('archive');
  const toRun = keys.filter((k) => k !== 'archive');

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

  if (hasArchive && !behavior.combine) {
    console.log('stan: start "archive"');
    const archivePath = await createArchive(cwd, outRel, {
      includes: config.includes ?? [],
      excludes: config.excludes ?? [],
    });
    console.log(`stan: done "archive" -> ${relForLog(cwd, archivePath)}`);
    created.push(archivePath);

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
