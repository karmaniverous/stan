/**
 * @file src/context/run.ts
 * Execution engine for stan. Runs configured scripts, manages archive/combined artifacts,
 * and supports `--diff` for archive diffs.
 *
 * NOTE: Global requirements live in /requirements.md.
 */
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { createArchive } from './archive';
import type { ContextConfig } from './config';
import { createArchiveDiff } from './diff';

// [snip: unchanged helpers — configOrder, relForLog, normalizeSelection, runOne, ensureOutDir, combineTextOutputs]

/**
 * Overload: mode provided separately from behavior.
 */
export async function runSelected(
  cwd: string,
  config: ContextConfig,
  selection?: Selection,
  mode?: ExecutionMode,
  behavior?: RunBehavior
): Promise<string[]>;

/**
 * Overload: mode omitted (behavior at 4th position).
 */
export async function runSelected(
  cwd: string,
  config: ContextConfig,
  selection?: Selection,
  behavior?: RunBehavior
): Promise<string[]>;

/** Implementation. */
export async function runSelected(
  cwd: string,
  config: ContextConfig,
  selection?: Selection,
  modeOrBehavior?: ExecutionMode | RunBehavior,
  behaviorMaybe?: RunBehavior
): Promise<string[]> {
  let mode: ExecutionMode = 'concurrent';
  let behavior: RunBehavior = {};

  if (typeof modeOrBehavior === 'string') {
    mode = modeOrBehavior;
    behavior = behaviorMaybe ?? {};
  } else {
    behavior = (modeOrBehavior as RunBehavior) ?? {};
  }

  const outRel = config.outputPath;
  const outAbs = await ensureOutDir(cwd, outRel, Boolean(behavior.keep));
  const orderFile = resolve(outAbs, 'order.txt');
  await writeFile(orderFile, '', 'utf8');

  const keysAll = configOrder(config);
  const keys = normalizeSelection(selection, config);

  const created: string[] = [];

  // Run non-archive scripts
  const toRun = keys.filter((k) => k !== 'archive');
  const runInConfigOrder = (list: string[]) =>
    list.sort((a, b) => keysAll.indexOf(a) - keysAll.indexOf(b));

  const runner = async (key: string) => runOne(cwd, outRel, key, config.scripts[key], orderFile);

  if (mode === 'sequential') {
    // Always respect *config* order in sequential mode, even if enumerated.
    for (const key of runInConfigOrder(toRun)) {
      await runner(key);
    }
  } else {
    await Promise.all(toRun.map((k) => runner(k)));
  }

  const hasArchive = keys.includes('archive');

  // Combine artifacts if requested.
  if (behavior.combine) {
    if (hasArchive) {
      // With archive selected: produce only a combined tar (do not also create archive.tar).
      const name = behavior.combinedFileName ?? 'combined';
      const tarPath = await createArchive(cwd, outRel, {
        includeOutputDir: true,
        includes: config.includes,
        excludes: config.excludes,
        fileName: `${name}.tar`
      });
      created.push(tarPath);
    } else {
      const name = behavior.combinedFileName ?? 'combined';
      const combined = await combineTextOutputs(cwd, outRel, toRun, name);
      created.push(combined);
    }
  }

  // Archive when selected (and not already combined above).
  if (hasArchive && !behavior.combine) {
    const archivePath = await createArchive(cwd, outRel, {
      includeOutputDir: false,
      includes: config.includes,
      excludes: config.excludes,
      fileName: `archive.tar`
    });
    created.push(archivePath);
  }

  // Create archive diff whenever requested and `archive` is included (with or without --combine).
  if (behavior.diff && hasArchive) {
    console.log('stan: start "archive (diff)"');
    const { diffPath } = await createArchiveDiff({ cwd, outputPath: outRel, baseName: 'archive' });
    console.log(`stan: done "archive (diff)" -> ${relForLog(cwd, diffPath)}`);
    created.push(diffPath);
  }

  return created;
}
