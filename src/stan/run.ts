/* src/stan/run.ts
 * Execute configured scripts; create per-script artifacts.
 * Archives are OFF by default; enabled only with -a/--archive.
 * - -c/--combine requires --archive and means include the output directory (script results) inside the archives and remove on-disk outputs after archiving.
 * - Always write archive.diff.tar whenever --archive is enabled (snapshot only when missing).
 * - An empty selection means "run nothing", but still create archives when --archive is passed.
 * - When STAN_DEBUG=1, stream child stdout/stderr to console while writing artifacts.
 * UPDATED:
 * - stanPath layout: outputs live under <stanPath>/output, diffs under <stanPath>/diff.
 */
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { appendFile, readdir, rm, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

import { createArchive } from './archive';
import type { ContextConfig } from './config';
import { ensureOutputDir } from './config';
import { createArchiveDiff } from './diff';
import { makeStanDirs } from './paths';
import { preflightDocsAndVersion } from './preflight';

export type Selection = string[] | null;
export type ExecutionMode = 'concurrent' | 'sequential';
export type RunBehavior = {
  combine?: boolean;
  keep?: boolean;
  archive?: boolean;
};

const relForLog = (cwd: string, absPath: string): string =>
  relative(cwd, absPath).replace(/\\/g, '/');

const configOrder = (config: ContextConfig): string[] =>
  Object.keys(config.scripts);

/**
 * Normalize selection to config order.
 * - When selection is null/undefined, return all config keys.
 * - When selection exists:
 *   - [] =\> run nothing
 *   - non-empty =\> order by config order
 */
const normalizeSelection = (
  selection: Selection | undefined | null,
  config: ContextConfig,
): string[] => {
  const all = configOrder(config);
  if (!selection) return all;
  if (selection.length === 0) return [];
  const requested = new Set(selection);
  return all.filter((k) => requested.has(k));
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
  outAbs: string,
  outRel: string,
  key: string,
  cmd: string,
  orderFile?: string,
): Promise<string> => {
  console.log(`stan: start "${key}"`);
  const outFile = resolve(outAbs, `${key}.txt`);
  const child = spawn(cmd, { cwd, shell: true, windowsHide: true });

  const debug = process.env.STAN_DEBUG === '1';
  const stream = createWriteStream(outFile, { encoding: 'utf8' });
  child.stdout.on('data', (d: Buffer) => {
    stream.write(d);
    if (debug) process.stdout.write(d);
  });
  child.stderr.on('data', (d: Buffer) => {
    stream.write(d);
    if (debug) process.stderr.write(d);
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
  console.log(`stan: done "${key}" -> ${outRel}/${key}.txt`);
  return outFile;
};

/** Render a readable, multi-line summary of the run plan. */
const renderRunPlan = (args: {
  selection: Selection;
  config: ContextConfig;
  mode: ExecutionMode;
  behavior: RunBehavior;
}): string => {
  const { selection, config, mode, behavior } = args;

  const keys = selection == null ? Object.keys(config.scripts) : selection;
  const scripts = keys ?? [];

  const dirs = makeStanDirs(process.cwd(), config.stanPath);

  const lines = [
    'STAN run plan',
    `mode: ${mode === 'sequential' ? 'sequential' : 'concurrent'}`,
    `output: ${dirs.outputRel}/`,
    `scripts: ${scripts.length ? scripts.join(', ') : 'none'}`,
    `archive: ${behavior.archive ? 'yes' : 'no'}`,
    `combine: ${behavior.combine ? 'yes' : 'no'}`,
    `keep output dir: ${behavior.keep ? 'yes' : 'no'}`,
  ];
  return `stan:\n  ${lines.join('\n  ')}`;
};

/** Remove on-disk outputs after archiving when combine=true (preserve archives). */
const cleanupOutputsAfterCombine = async (
  cwd: string,
  outAbs: string,
): Promise<void> => {
  const entries = await readdir(outAbs, { withFileTypes: true });
  const keepNames = new Set(['archive.tar', 'archive.diff.tar']);
  await Promise.all(
    entries.map(async (e) => {
      if (keepNames.has(e.name)) return;
      await rm(resolve(outAbs, e.name), { recursive: true, force: true });
    }),
  );
};

/** Clear <stanPath>/patch contents after archiving (preserve the directory). */
const cleanupPatchDirAfterArchive = async (
  cwd: string,
  stanPath: string,
): Promise<void> => {
  const dirs = makeStanDirs(cwd, stanPath);
  try {
    const entries = await readdir(dirs.patchAbs, { withFileTypes: true });
    await Promise.all(
      entries.map((e) =>
        rm(resolve(dirs.patchAbs, e.name), { recursive: true, force: true }),
      ),
    );
  } catch {
    // best-effort
  }
};

export const runSelected = async (
  cwd: string,
  config: ContextConfig,
  selection: Selection = null,
  mode: ExecutionMode = 'concurrent',
  behaviorMaybe?: RunBehavior,
): Promise<string[]> => {
  const behavior: RunBehavior = behaviorMaybe ?? {};

  // Preflight docs/version (non-blocking; best-effort)
  try {
    await preflightDocsAndVersion(cwd);
  } catch {}
  // ensure directory tree
  await ensureOutputDir(cwd, config.stanPath, Boolean(behavior.keep));
  const dirs = makeStanDirs(cwd, config.stanPath);
  const outAbs = dirs.outputAbs;

  // Multi-line plan summary
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

  const toRun = normalizeSelection(selection, config);

  const created: string[] = [];

  // Run scripts only when selection non-empty
  if (toRun.length > 0) {
    const runner = async (k: string): Promise<void> => {
      const p = await runOne(
        cwd,
        outAbs,
        dirs.outputRel,
        k,
        config.scripts[k],
        orderFile,
      );
      created.push(p);
    };

    if (mode === 'sequential') {
      for (const k of toRun) {
        await runner(k);
      }
    } else {
      await Promise.all(toRun.map((k) => runner(k).then(() => void 0)));
    }
  }

  // ARCHIVE PHASE
  if (behavior.archive) {
    const includeOutputs = Boolean(behavior.combine);

    console.log('stan: start "archive"');
    const archivePath = await createArchive(cwd, config.stanPath, {
      includeOutputDir: includeOutputs,
      includes: config.includes ?? [],
      excludes: config.excludes ?? [],
    });
    console.log(`stan: done "archive" -> ${relForLog(cwd, archivePath)}`);

    console.log('stan: start "archive (diff)"');
    const { diffPath } = await createArchiveDiff({
      cwd,
      stanPath: config.stanPath,
      baseName: 'archive',
      includes: config.includes ?? [],
      excludes: config.excludes ?? [],
      updateSnapshot: 'createIfMissing',
      includeOutputDirInDiff: includeOutputs,
    });
    console.log(`stan: done "archive (diff)" -> ${relForLog(cwd, diffPath)}`);

    if (includeOutputs) {
      await cleanupOutputsAfterCombine(cwd, outAbs);
    }
    await cleanupPatchDirAfterArchive(cwd, config.stanPath);

    created.push(archivePath, diffPath);
  }

  return created;
};
