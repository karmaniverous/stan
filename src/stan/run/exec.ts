// src/stan/run/exec.ts
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { cyan, green } from '@/stan/util/color';

import type { ContextConfig } from '../config';
import type { ExecutionMode, Selection } from './types';

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

export const runOne = async (
  cwd: string,
  outAbs: string,
  outRel: string,
  key: string,
  cmd: string,
  orderFile?: string,
): Promise<string> => {
  console.log(`stan: start "${cyan(key)}"`);
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
  console.log(
    `stan: ${green('done')} "${cyan(key)}" -> ${cyan(`${outRel}/${key}.txt`)}`,
  );
  return outFile;
};

export const runScripts = async (
  cwd: string,
  outAbs: string,
  outRel: string,
  config: ContextConfig,
  toRun: string[],
  mode: ExecutionMode,
  orderFile?: string,
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
