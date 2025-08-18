/**
 * @file src/context/run.ts
 * Execution engine for ctx. Runs configured scripts, manages archive/combined artifacts,
 * and supports `--diff` for archive diffs.
 *
 * NOTE: Global requirements live in /requirements.md.
 */
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import { createArchive } from './archive';
import type { ContextConfig, CtxConfig } from './config';
import { createArchiveDiff } from './diff';

/** Execution mode. */
export type ExecutionMode = 'concurrent' | 'sequential';

/** Behavior flags. */
export interface RunBehavior {
  combine?: boolean;
  keep?: boolean;
  diff?: boolean;
  combinedFileName?: string;
}

export type Selection =
  | undefined
  | null
  | string[]
  | { include: string[]; except?: boolean };

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
  await mkdir(join(dest, '..'), { recursive: true }).catch(() => void 0);
  await writeFile(dest, data, 'utf8');
};

const relForLog = (cwd: string, abs: string): string => {
  const r = abs.startsWith(cwd) ? abs.slice(cwd.length + 1) : abs;
  return r.replace(/\\/g, '/');
};

const runJob = async (cwd: string, key: string, command: string, outRel: string): Promise<string> => {
  const start = Date.now();
  // Announce
  console.log(`ctx: start "${key}" (${command})`);

  const dest = resolve(cwd, outRel, `${key}.txt`);
  await mkdir(join(dest, '..'), { recursive: true });
  const ws = createWriteStream(dest, { encoding: 'utf8' });

  await new Promise<void>((res, rej) => {
    const cp = spawnScript(command, cwd);
    cp.stdout?.pipe(ws, { end: false });
    cp.stderr?.pipe(ws, { end: false });
    cp.on('error', rej);
    cp.on('close', (code) => {
      ws.end(() => {
        if (code === 0) res();
        else rej(new Error(`${key} exited with code ${code ?? -1}`));
      });
    });
  });

  const end = Date.now();
  // Announce
  console.log(`ctx: done "${key}" in ${end - start}ms -> ${relForLog(cwd, dest)}`);
  return dest;
};

const computeSelection = (allKeys: string[], selection: Selection): string[] => {
  const baseKeys = Array.from(new Set(['archive', ...allKeys]));
  if (!selection || (Array.isArray(selection) && selection.length === 0)) {
    return baseKeys;
  }
  if (Array.isArray(selection)) return selection.slice();
  const include = selection.include ?? [];
  const except = Boolean(selection.except);
  if (except) {
    return baseKeys.filter((k) => !include.includes(k));
  }
  return include.slice();
};

const includesArchive = (keys: string[]): boolean => keys.includes('archive');

const combineTextOutputs = async (
  cwd: string,
  outputPath: string,
  files: string[],
  baseName: string
): Promise<string> => {
  const dest = resolve(cwd, outputPath, `${baseName}.txt`);
  const header = (k: string, type: 'BEGIN' | 'END') => `${type} [${k}]`;
  const parts: string[] = [];
  for (const f of files) {
    const key = basename(f, '.txt');
    parts.push(header(key, 'BEGIN'));
    parts.push(await readFile(f, 'utf8'));
    parts.push(header(key, 'END'));
  }
  await writeText(dest, parts.join('\n'));
  return dest;
};

function parseArgs(
  args: [string, ContextConfig | CtxConfig, Selection?, ExecutionMode?, RunBehavior?] |
        [string, ContextConfig | CtxConfig, Selection?, RunBehavior?]
): { cwd: string; config: ContextConfig; selection: Selection; mode: ExecutionMode; behavior: RunBehavior } {
  const cwd = args[0];
  const config = args[1] as ContextConfig;
  let selection: Selection = args[2];
  let mode: ExecutionMode = 'concurrent';
  let behavior: RunBehavior = {};
  if (typeof args[3] === 'string' || typeof args[3] === 'undefined') {
    mode = (args[3] as ExecutionMode) ?? 'concurrent';
    behavior = (args[4] as RunBehavior) ?? {};
  } else {
    behavior = (args[3] as RunBehavior) ?? {};
  }
  return { cwd, config, selection, mode, behavior };
}

/**
 * Run selected scripts and manage artifacts.
 *
 * Overloads:
 *   runSelected(cwd, config, selection?, mode?, behavior?)
 *   runSelected(cwd, config, selection?, behavior?) // 4th arg is behavior
 */
export async function runSelected(
  cwd: string, config: ContextConfig | CtxConfig, selection?: Selection, mode?: ExecutionMode, behavior?: RunBehavior
): Promise<string[]>;
export async function runSelected(
  cwd: string, config: ContextConfig | CtxConfig, selection?: Selection, behavior?: RunBehavior
): Promise<string[]>;
export async function runSelected(
  ...args: [string, ContextConfig | CtxConfig, Selection?, ExecutionMode?, RunBehavior?] |
          [string, ContextConfig | CtxConfig, Selection?, RunBehavior?]
): Promise<string[]> {
  const { cwd, config, selection, mode, behavior } = parseArgs(args as any);

  const outRel = config.outputPath;
  const selected = computeSelection(Object.keys(config.scripts), selection);
  const hasArchive = includesArchive(selected);

  // --diff implies --keep so previous artifacts remain available.
  const effectiveKeep = Boolean(behavior.keep || (behavior.diff && hasArchive));
  await ensureOutDir(cwd, outRel, effectiveKeep);

  const created: string[] = [];
  const nonArchive = selected.filter((k) => k !== 'archive');
  const ordered: string[] = (() => {
    if (mode === 'sequential') {
      if (selection && !Array.isArray(selection) && selection.include?.length) return selected.slice();
      if (Array.isArray(selection) && selection.length > 0) return selected.slice();
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
        const result = await (createArchive as any)(cwd, outRel, { includeOutputDir: true, fileName: `${combinedName}.tar` });
        const dest = typeof result === 'string' ? result : result.archivePath;
        created.push(dest);
        return [dest];
      }
      const result = await (createArchive as any)(cwd, outRel);
      const dest = typeof result === 'string' ? result : result.archivePath;
      created.push(dest);
      return [dest];
    }
    const dest = await runJob(cwd, key, (config.scripts as Record<string, string>)[key], outRel);
    created.push(dest);
    return [dest];
  };

  // Validate enumerated keys (unknown => throw)
  const available = new Set(['archive', ...Object.keys(config.scripts)]);
  for (const k of ordered) {
    if (!available.has(k)) throw new Error(`Unknown script key: ${k}`);
  }

  if (mode === 'sequential') {
    for (const k of ordered) await runKey(k);
  } else {
    await Promise.all(ordered.map((k) => runKey(k)));
  }

  // With --combine but without archive: generate combined text file
  if (behavior.combine && !hasArchive) {
    const combinedName = behavior.combinedFileName ?? 'combined';
    const textFiles = created.filter((p) => p.endsWith('.txt'));
    const combined = await combineTextOutputs(cwd, outRel, textFiles, combinedName);
    created.push(combined);
  }

  // Create archive diff whenever requested and `archive` is included (with or without --combine).
  if (behavior.diff && hasArchive) {
    console.log('ctx: start "archive (diff)"');
    const { diffPath } = await createArchiveDiff({ cwd, outputPath: outRel, baseName: 'archive' });
    console.log(`ctx: done "archive (diff)" -> ${relForLog(cwd, diffPath)}`);
    created.push(diffPath);
  }

  return created;
}
