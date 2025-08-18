/**
 * @file src/context/run.ts
 * @description Execution engine for ctx. Runs configured scripts, manages archive/combined artifacts,
 * and supports `--diff` for archive diffs.
 *
 * @requirements
 * - Accept selection of scripts by explicit enumeration or `--except`.
 * - Support concurrent (default) and sequential (`-s/--sequential`) execution.
 * - Always create the output directory if missing.
 * - Default behavior clears the output directory; `-k/--keep` preserves it.
 * - `archive` is a reserved script key that triggers tar creation via createArchive().
 * - `--combine`:
 *   (a) When `archive` is present, run all non‑archive jobs first, then create a single combined tar
 *       that explicitly includes the output directory contents. Do **not** also create `archive.tar`.
 *   (b) When `archive` is not present (e.g., enumerated without it or excluded with `--except`),
 *       combine the produced text outputs into a single `<name>.txt` file.
 * - `--diff`: When `archive` is included (with or without `--combine`), create an `archive.diff.tar`
 *   using a content snapshot of the workspace (excluding the output directory). `--diff` implies
 *   `--keep` so previous artifacts remain available.
 */

import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import { createArchive } from './archive';
import type { ContextConfig } from './config';
import { createArchiveDiff } from './diff';

/** Execution mode. */
export type ExecutionMode = 'concurrent' | 'sequential';

/** Behavior flags. */
export interface RunBehavior {
  except?: string[];
  sequential?: boolean;
  combine?: boolean;
  keep?: boolean;
  diff?: boolean;
  combinedFileName?: string;
}

/** Spawn a shell command using the same agent as NPM scripts. */
const spawnScript = (command: string, cwd: string) =>
  spawn(command, { cwd, shell: true, windowsHide: true });

/** Ensure output directory exists; clear it unless `keep` is true. */
const ensureOutDir = async (cwd: string, outputPath: string, keep: boolean): Promise<string> => {
  const outAbs = resolve(cwd, outputPath);
  await mkdir(outAbs, { recursive: true });
  if (!keep) {
    await rm(outAbs, { recursive: true, force: true });
    await mkdir(outAbs, { recursive: true });
  }
  return outAbs;
};

/** Write to a file (best‑effort atomic). */
const writeText = async (dest: string, data: string): Promise<void> => {
  await writeFile(dest, data);
};

const readText = async (abs: string): Promise<string> => String(await readFile(abs));

/** For logs. */
const relForLog = (cwd: string, abs: string): string => (abs.startsWith(cwd) ? abs.slice(cwd.length + 1) : abs);

/**
 * Run a single job and write `<key>.txt` capturing stdout **and** stderr.
 */
export const runJob = async (cwd: string, key: string, command: string, outputPath: string): Promise<string> => {
  const dest = resolve(cwd, outputPath, `${key}.txt`);
  const start = Date.now();
   
  console.log(`ctx: start "${key}" (${command})`);
  await mkdir(resolve(dest, '..'), { recursive: true });

  const child = spawnScript(command, cwd);

  await new Promise<void>((res, rej) => {
    const ws = createWriteStream(dest, { flags: 'w' });
    child.stdout?.pipe(ws, { end: false });
    child.stderr?.pipe(ws, { end: false });
    child.on('error', rej);
    child.on('exit', (code) => {
      ws.end(() => {
        if (code === 0) res();
        else rej(new Error(`${key} exited with code ${code ?? -1}`));
      });
    });
  });

  const end = Date.now();
   
  console.log(`ctx: done "${key}" in ${end - start}ms -> ${relForLog(cwd, dest)}`);
  return dest;
};

const computeSelection = (allKeys: string[], enumerated: string[] | null, except: string[] | undefined): string[] => {
  const normalizedExcept = new Set((except ?? []).map((k) => k.trim()).filter(Boolean));
  if (enumerated && enumerated.length > 0) {
    return enumerated.filter((k) => !normalizedExcept.has(k));
  }
  return allKeys.filter((k) => !normalizedExcept.has(k));
};

const includesArchive = (keys: string[]): boolean => keys.includes('archive');

const combineTextOutputs = async (
  cwd: string,
  outputPath: string,
  files: string[],
  baseName: string
): Promise<string> => {
  const dest = resolve(cwd, outputPath, `${baseName}.txt`);
  const pieces: string[] = [];
  for (const f of files) {
    const name = basename(f);
    const body = await readText(f);
    pieces.push(`========== ${name} ==========\n${body.trim()}\n`);
  }
  await writeText(dest, pieces.join('\n'));
  return dest;
};

/**
 * Run the selected jobs with the provided behavior.
 * Returns absolute paths of all files written (text outputs, archive, combined, diff).
 */
export const runSelected = async (
  cwd: string,
  config: ContextConfig,
  enumerated: string[] | null,
  behavior: RunBehavior = {}
): Promise<string[]> => {
  const outRel = config.outputPath;
  const allKeys = Object.keys(config.scripts);
  const selected = computeSelection(allKeys, enumerated, behavior.except);
  const hasArchive = includesArchive(selected);

  // --diff implies --keep when archive is selected (regardless of --combine)
  const effectiveKeep = Boolean(behavior.keep || (behavior.diff && hasArchive));
  await ensureOutDir(cwd, outRel, effectiveKeep);

  const created: string[] = [];
  const nonArchive = selected.filter((k) => k !== 'archive');
  const ordered: string[] = (() => {
    if (behavior.sequential) {
      if (enumerated && enumerated.length > 0) return selected.slice();
      // Sequential without explicit enumeration: archive last
      return [...nonArchive, ...(hasArchive ? ['archive'] : [])];
    }
    return selected.slice();
  })();

  const runKey = async (key: string): Promise<string[]> => {
    if (key === 'archive') {
      if (behavior.combine) {
        // Combined tar includes the output directory explicitly.
        const combinedName = behavior.combinedFileName ?? 'combined';
        const dest = await createArchive(cwd, outRel, { includeOutputDir: true, fileName: `${combinedName}.tar` });
        created.push(dest);
        return [dest];
      }
      const dest = await createArchive(cwd, outRel);
      created.push(dest);
      return [dest];
    }
    const dest = await runJob(cwd, key, config.scripts[key], outRel);
    created.push(dest);
    return [dest];
  };

  if (behavior.combine && hasArchive) {
    // Non‑archive first, then the combined archive tar
    if (behavior.sequential) {
      for (const k of nonArchive) created.push(...(await runKey(k)));
      created.push(...(await runKey('archive')));
    } else {
      const nonArchiveResults = await Promise.all(nonArchive.map((k) => runKey(k)));
      created.push(...nonArchiveResults.flat());
      created.push(...(await runKey('archive')));
    }
  } else if (behavior.sequential) {
    for (const k of ordered) {
      created.push(...(await runKey(k)));
    }
  } else {
    const results = await Promise.all(ordered.map((k) => runKey(k)));
    created.push(...results.flat());
  }

  // With --combine but without archive: generate combined text file
  if (behavior.combine && !hasArchive) {
    const combinedName = behavior.combinedFileName ?? 'combined';
    const textFiles = created.filter((p) => p.endsWith('.txt'));
    created.push(await combineTextOutputs(cwd, outRel, textFiles, combinedName));
  }

  // NEW: Create archive diff whenever requested and `archive` is included (with or without --combine).
  if (behavior.diff && hasArchive) {
     
    console.log('ctx: start "archive (diff)"');
    const { diffPath } = await createArchiveDiff({ cwd, outputPath: outRel, baseName: 'archive' });
     
    console.log(`ctx: done "archive (diff)" -> ${relForLog(cwd, diffPath)}`);
    created.push(diffPath);
  }

  return created;
};
