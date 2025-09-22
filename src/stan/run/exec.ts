// src/stan/run/exec.ts
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { cyan, green } from '@/stan/util/color';

import type { ContextConfig } from '../config';
import type { ExecutionMode, Selection } from './types';

type RunHooks = {
  onStart?: (key: string) => void;
  onEnd?: (
    key: string,
    outFileAbs: string,
    startedAt: number,
    endedAt: number,
  ) => void;
};

const waitForStreamClose = (stream: NodeJS.WritableStream): Promise<void> =>
  new Promise<void>((resolveP, rejectP) => {
    stream.on('close', () => resolveP());
    stream.on('error', (e) =>
      rejectP(e instanceof Error ? e : new Error(String(e))),
    );
  });

const configOrder = (config: ContextConfig): string[] =>
  Object.keys(config.scripts);

/**
 * Normalize selection to config order.
 * - When selection is null/undefined, return all config keys.
 * - When selection exists:
 *   - [] =\> run nothing
 *   - non-empty =\> order by config order
 */
export const normalizeSelection = (
  selection: Selection | undefined | null,
  config: ContextConfig,
): string[] => {
  const all = configOrder(config);
  if (!selection) return all;
  if (selection.length === 0) return [];
  const requested = new Set(selection);
  return all.filter((k) => requested.has(k));
};

/**
 * Run a single configured script and write its combined stdout/stderr to
 * `outRel/<key>.txt`.
 *
 * @param cwd - Working directory for the child process.
 * @param outAbs - Absolute output directory.
 * @param outRel - Relative output directory (for logs).
 * @param key - Script key (for logs and filename).
 * @param cmd - Shell command to execute.
 * @param orderFile - Optional order file to append a single letter marker.
 * @returns Absolute path to the generated output file.
 */
export const runOne = async (
  cwd: string,
  outAbs: string,
  outRel: string,
  key: string,
  cmd: string,
  orderFile?: string,
  hooks?: RunHooks,
): Promise<string> => {
  console.log(`stan: start "${cyan(key)}"`);
  const outFile = resolve(outAbs, `${key}.txt`);
  const startedAt = Date.now();
  hooks?.onStart?.(key);
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

  hooks?.onEnd?.(key, outFile, startedAt, Date.now());

  if (orderFile) {
    await appendFile(orderFile, key.slice(0, 1).toUpperCase(), 'utf8');
  }
  console.log(
    `stan: ${green('done')} "${cyan(key)}" -> ${cyan(`${outRel}/${key}.txt`)}`,
  );
  return outFile;
};

/**
 * Run a set of scripts concurrently or sequentially.
 *
 * @param cwd - Working directory for child processes.
 * @param outAbs - Absolute output directory.
 * @param outRel - Relative output directory (for logs).
 * @param config - Resolved configuration.
 * @param toRun - Keys to run (must be present in config).
 * @param mode - Execution mode.
 * @param orderFile - Optional order file path (when present, records execution order).
 * @returns Absolute paths to generated output files.
 */
export const runScripts = async (
  cwd: string,
  outAbs: string,
  outRel: string,
  config: ContextConfig,
  toRun: string[],
  mode: ExecutionMode,
  orderFile?: string,
  hooks?: RunHooks,
): Promise<string[]> => {
  const created: string[] = [];
  const runner = async (k: string): Promise<void> => {
    const p = await runOne(
      cwd,
      outAbs,
      outRel,
      k,
      config.scripts[k],
      orderFile,
      hooks,
    );
    created.push(p);
  };
  if (mode === 'sequential') {
    for (const k of toRun) await runner(k);
  } else {
    await Promise.all(toRun.map((k) => runner(k).then(() => void 0)));
  }
  return created;
};
