// src/stan/run/service.ts
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { ContextConfig } from '@/stan/config';
import { ensureOutputDir } from '@/stan/config';

import { makeStanDirs } from '../paths';
import { preflightDocsAndVersion } from '../preflight';
import { archivePhase } from './archive';
import { runScripts } from './exec';
import { renderRunPlan } from './plan';
import type { ExecutionMode, RunBehavior, Selection } from './types';

const shouldWriteOrder =
  process.env.NODE_ENV === 'test' || process.env.STAN_WRITE_ORDER === '1';

/**
 * High‑level runner for `stan run`.
 *
 * Responsibilities:
 * - Preflight docs/version (best‑effort).
 * - Ensure output/diff directories.
 * - Print the run plan.
 * - Optional notification:
 *   - When behavior.ding is true, play a terminal bell (ASCII BEL) once at the
 *     end of the run. This is the most portable cross‑platform option and avoids
 *     platform‑specific sound dependencies.
 * - Execute selected scripts (in the chosen mode).
 * - Optionally create regular and diff archives (combine/keep behaviors).
 * * @param cwd - Repo root for execution.
 * @param config - Resolved configuration.
 * @param selection - Explicit list of script keys (or `null` to run all).
 * @param mode - Execution mode (`concurrent` by default).
 * @param behaviorMaybe - Archive/combine/keep flags.
 * @returns Absolute paths to created artifacts (script outputs and/or archives).
 */
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
  } catch (err) {
    if (process.env.STAN_DEBUG === '1') {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('stan: preflight failed', msg);
    }
  }

  // ensure directory tree
  await ensureOutputDir(cwd, config.stanPath, Boolean(behavior.keep));
  const dirs = makeStanDirs(cwd, config.stanPath);
  const outAbs = dirs.outputAbs;

  // Multi-line plan summary
  console.log(
    renderRunPlan(cwd, {
      selection,
      config,
      mode,
      behavior,
    }),
  );

  let orderFile: string | undefined;
  if (shouldWriteOrder) {
    orderFile = resolve(outAbs, 'order.txt');
    if (!behavior.keep) {
      await writeFile(orderFile, '', 'utf8');
    }
  }

  // Build the run list:
  // - When selection is null/undefined, run all scripts in config order.
  // - When selection is provided (even empty), respect the provided order.
  const selected = selection == null ? Object.keys(config.scripts) : selection;

  // Filter to known script keys to avoid spawning undefined commands.
  const toRun = selected.filter((k) =>
    Object.prototype.hasOwnProperty.call(config.scripts, k),
  );

  const created: string[] = [];

  // Run scripts only when selection non-empty
  if (toRun.length > 0) {
    const outRel = dirs.outputRel;
    const scriptOutputs = await runScripts(
      cwd,
      outAbs,
      outRel,
      config,
      toRun,
      mode,
      orderFile,
    );
    created.push(...scriptOutputs);
  }

  // ARCHIVE PHASE
  if (behavior.archive) {
    const includeOutputs = Boolean(behavior.combine);
    const { archivePath, diffPath } = await archivePhase({
      cwd,
      config,
      includeOutputs,
    });
    created.push(archivePath, diffPath);
  }

  // Final notification (terminal bell) when requested.
  if (behavior.ding) {
    try {
      // ASCII BEL (may be disabled in some terminals; intentionally simple and portable)
      process.stdout.write('\x07');
    } catch {
      // best‑effort; ignore failures
    }
  }
  return created;
};
