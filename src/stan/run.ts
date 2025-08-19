/* src/stan/run.ts
 * REQUIREMENTS (current + updated):
 * - Execute configured scripts; create per-script artifacts.
 * - Always produce <outputPath>/archive.diff.tar whenever 'archive' is included.
 * - Snapshot update occurs only if one does not exist (create) or via `stan snap`.
 * - NEW: pass updateSnapshot='createIfMissing' to createArchiveDiff.
 * - Combine mode remains; when archive is included, still write archive.diff.tar.
 * - UPDATED: The plan summary printed before the script log should be attractively
 *   formatted with newlines and clear labels, not a single line.
 */
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

import { createArchive } from '@/stan/archive';
import type { ContextConfig } from '@/stan/config';
import { ensureOutputDir } from '@/stan/config';
import { createArchiveDiff } from '@/stan/diff';

export type Selection = string[] | null;
export type ExecutionMode = 'concurrent' | 'sequential';
export type RunBehavior = {
  combine?: boolean;
  keep?: boolean;
  diff?: boolean; // retained for plan logging; no longer gates diff creation
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

  if (requested.has('archive')) ordered.push('archive');
  return ordered;
};

const waitForStreamClose = (stream: NodeJS.WritableStream): Promise<void> =>
  new Promise<void>((resolveP, rejectP) => {
    stream.on('close', () => resolveP());
    stream.on('error', (e) =>
      rejectP(e instanceof Error ? e : new Error(String(e))),
    );
  });

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
    child.on('error', (e) =>
      rejectP(e instanceof Error ? e : new Error(String(e))),
    );
    child.on('close', () => resolveP());
  });
  stream.end();
  await waitForStreamClose(stream);

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

/** Render a readable, multi-line summary of the run plan. */
const renderRunPlan = (args: {
  selection: Selection;
  config: ContextConfig;
  mode: ExecutionMode;
  behavior: RunBehavior;
}): string => {
  const { selection, config, mode, behavior } = args;

  const includeArchiveByDefault = selection == null || selection.length === 0;
  const willArchive =
    includeArchiveByDefault ||
    (Array.isArray(selection) && selection.includes('archive'));

  // Determine script list shown (exclude 'archive' to avoid confusion)
  const keys = selection == null ? Object.keys(config.scripts) : selection;
  const scripts = (keys ?? []).filter((k) => k !== 'archive');

  const lines = [
    'STAN run plan',
    `mode: ${mode === 'sequential' ? 'sequential' : 'concurrent'}`,
    `output: ${config.outputPath}/`,
    `scripts: ${scripts.length ? scripts.join(', ') : 'none'}`,
    `archive: ${willArchive ? 'yes' : 'no'}`,
    `combine: ${behavior.combine ? 'yes' : 'no'}`,
    `diff: ${behavior.diff ? 'yes' : 'no'}`, // retained for compatibility
    `keep output dir: ${behavior.keep ? 'yes' : 'no'}`,
  ];
  return `stan:\n  ${lines.join('\n  ')}`;
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

  // Multi-line plan summary (project-level directive).
  console.log(
    renderRunPlan({
      selection,
      config,
      mode,
      behavior,
    }),
  );

  const shouldWriteOrder =
    process.env.NODE_ENV === 'test' || process.env.STAN_WRITE_ORDER === '1';

  let orderFile: string | undefined;
  if (shouldWriteOrder) {
    orderFile = resolve(outAbs, 'order.txt');
    if (!behavior.keep) {
      await writeFile(orderFile, '', 'utf8');
    }
  }

  const baseKeys = normalizeSelection(selection, config);
  if (baseKeys.length === 0) return [];

  const includeArchiveByDefault = selection == null || selection.length === 0;
  const hasArchive = includeArchiveByDefault || baseKeys.includes('archive');

  const toRun = baseKeys.filter((k) => k !== 'archive');

  const created: string[] = [];
  const runner = async (k: string): Promise<void> => {
    const p = await runOne(cwd, outRel, k, config.scripts[k], orderFile);
    created.push(p);
  };

  if (mode === 'sequential') {
    for (const k of toRun) {
      await runner(k);
    }
    // Archive after others
    if (hasArchive && !behavior.combine) {
      console.log('stan: start "archive"');
      const archivePath = await createArchive(cwd, outRel, {
        includes: config.includes ?? [],
        excludes: config.excludes ?? [],
      });
      console.log(`stan: done "archive" -> ${relForLog(cwd, archivePath)}`);
      created.push(archivePath);

      // Always produce diff (snapshot only when missing)
      console.log('stan: start "archive (diff)"');
      const { diffPath } = await createArchiveDiff({
        cwd,
        outputPath: outRel,
        baseName: 'archive',
        includes: config.includes ?? [],
        excludes: config.excludes ?? [],
        updateSnapshot: 'createIfMissing',
      });
      console.log(`stan: done "archive (diff)" -> ${relForLog(cwd, diffPath)}`);
      created.push(diffPath);
    }
  } else {
    // Run non-archive tasks concurrently
    const tasks: Array<Promise<void>> = toRun.map((k) =>
      runner(k).then(() => void 0),
    );
    await Promise.all(tasks);

    // Archive AFTER other tasks (avoid collisions)
    if (hasArchive && !behavior.combine) {
      console.log('stan: start "archive"');
      const archivePath = await createArchive(cwd, outRel, {
        includes: config.includes ?? [],
        excludes: config.excludes ?? [],
      });
      console.log(`stan: done "archive" -> ${relForLog(cwd, archivePath)}`);
      created.push(archivePath);

      console.log('stan: start "archive (diff)"');
      const { diffPath } = await createArchiveDiff({
        cwd,
        outputPath: outRel,
        baseName: 'archive',
        includes: config.includes ?? [],
        excludes: config.excludes ?? [],
        updateSnapshot: 'createIfMissing',
      });
      console.log(`stan: done "archive (diff)" -> ${relForLog(cwd, diffPath)}`);
      created.push(diffPath);
    }
  }

  if (behavior.combine) {
    const base =
      behavior.combinedFileName ?? config.combinedFileName ?? 'combined';
    if (hasArchive) {
      const tarPath = resolve(outAbs, `${base}.tar`);
      // Dynamic ESM import boundary; tar module is narrowed to the subset we use (create with filter).
      const tar = (await import('tar')) as unknown as {
        create: (
          opts: {
            file: string;
            cwd?: string;
            filter?: (path: string, stat: unknown) => boolean;
          },
          files: string[],
        ) => Promise<void>;
      };
      // Exclude <outputPath>/.diff from the combined tar contents.
      await tar.create(
        {
          file: tarPath,
          cwd,
          filter: (p: string) =>
            !(p === `${outRel}/.diff` || p.startsWith(`${outRel}/.diff/`)),
        },
        [outRel],
      );
      created.push(tarPath);

      // Always produce diff alongside archive-included runs (even in combine)
      console.log('stan: start "archive (diff)"');
      const { diffPath } = await createArchiveDiff({
        cwd,
        outputPath: outRel,
        baseName: 'archive',
        includes: config.includes ?? [],
        excludes: config.excludes ?? [],
        updateSnapshot: 'createIfMissing',
      });
      console.log(`stan: done "archive (diff)" -> ${relForLog(cwd, diffPath)}`);
      created.push(diffPath);
    } else {
      const p = await combineTextOutputs(cwd, outRel, toRun, base);
      created.push(p);
    }
  }

  return created;
};
