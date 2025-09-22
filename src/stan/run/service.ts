import { writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

import type { ContextConfig } from '@/stan/config';
import { ensureOutputDir } from '@/stan/config';

import { makeStanDirs } from '../paths';
import { preflightDocsAndVersion } from '../preflight';
import { archivePhase } from './archive';
import { runScripts } from './exec';
import { installCancelKeys } from './input/keys';
import { ProgressRenderer } from './live/renderer';
import { ProcessSupervisor } from './live/supervisor';
import { renderRunPlan } from './plan';
import type { ExecutionMode, RunBehavior } from './types';

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
 * @param cwd - Repo root for execution.
 * @param config - Resolved configuration.
 * @param selection - Explicit list of script keys (or `null` to run all).
 * @param mode - Execution mode (`concurrent` by default).
 * @param behaviorMaybe - Archive/combine/keep flags.
 * @returns Absolute paths to created artifacts (script outputs and/or archives).
 */
export const runSelected = async (
  cwd: string,
  config: ContextConfig,
  selection: string[] | null = null,
  mode: ExecutionMode = 'concurrent',
  behaviorMaybe?: RunBehavior,
): Promise<string[]> => {
  const behavior: RunBehavior = behaviorMaybe ?? {};
  let cancelled = false;
  const cancelledKeys = new Set<string>();
  const supervisor = new ProcessSupervisor({
    hangWarn: behavior.hangWarn,
    hangKill: behavior.hangKill,
    hangKillGrace: behavior.hangKillGrace,
  });

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
  console.log(''); // exactly one blank line between plan and first live frame

  let orderFile: string | undefined;
  if (shouldWriteOrder) {
    orderFile = resolve(outAbs, 'order.txt');
    if (!behavior.keep) {
      await writeFile(orderFile, '', 'utf8');
    }
  }

  // TTY-only live renderer
  const stdoutLike = process.stdout as unknown as { isTTY?: boolean };
  const isTTY = Boolean(stdoutLike?.isTTY);
  const liveEnabled = (behavior.live ?? true) && isTTY;

  let renderer: ProgressRenderer | undefined;
  let restoreCancel: (() => void) | null = null;

  if (liveEnabled) {
    renderer = new ProgressRenderer({
      boring: process.env.STAN_BORING === '1',
    });
    // Pre-register archive rows when we intend to archive so the UI shows "waiting"
    if (behavior.archive) {
      renderer.update(
        'archive:full',
        { kind: 'waiting' },
        { type: 'archive', item: 'full' },
      );
      renderer.update(
        'archive:diff',
        { kind: 'waiting' },
        { type: 'archive', item: 'diff' },
      );
    }
    renderer.start();
  }

  // Build the run list:
  // - When selection is null/undefined, run all scripts in config order.
  // - When selection is provided (even empty), respect the provided order.
  const selected = selection == null ? Object.keys(config.scripts) : selection;

  // Filter to known script keys to avoid spawning undefined commands.
  const toRun = selected.filter((k) =>
    Object.prototype.hasOwnProperty.call(config.scripts, k),
  );

  // Initialize live table rows (TTY only) as "waiting"
  if (renderer) {
    for (const k of toRun)
      renderer.update(
        `script:${k}`,
        { kind: 'waiting' },
        { type: 'script', item: k },
      );
  }

  // Idempotent cancellation pipeline
  const triggerCancel = (): void => {
    if (cancelled) return;
    cancelled = true;
    if (renderer) {
      // Suppress any late "done" updates for scripts after cancel
      for (const k of toRun) cancelledKeys.add(`script:${k}`);
      // Finalize in‑flight rows as cancelled with accurate durations; keep
      // completed rows (done/error/timedout/killed) untouched so their times
      // and output paths remain visible.
      try {
        (renderer as { cancelPending?: () => void }).cancelPending?.();
      } catch {
        /* best‑effort */
      }
      // Flush a final frame, then stop the renderer so its interval doesn’t
      // keep the event loop alive after user cancellation.
      renderer.flush();
      try {
        renderer.stop();
      } catch {
        /* ignore */
      }
    }
    // Tear down keypress/SIGINT wiring immediately upon cancellation.
    if (restoreCancel) {
      try {
        restoreCancel();
      } catch {
        /* ignore */
      }
      restoreCancel = null;
    }
    // Signal processes and escalate to KILL without grace on user cancel.
    supervisor.cancelAll({ immediate: true });
  };

  // Install cancel keys (q/Ctrl+C) + SIGINT parity once we know toRun (TTY only)
  if (liveEnabled) {
    const sub = installCancelKeys(triggerCancel);
    restoreCancel = sub.restore;
  }

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
      renderer
        ? {
            onStart: (key) => {
              const rowKey = `script:${key}`;
              renderer?.update(
                rowKey,
                { kind: 'running', startedAt: Date.now() },
                { type: 'script', item: key },
              );
            },
            onEnd: (key, outFileAbs, startedAt, endedAt) => {
              // Skip "done" updates for rows already marked cancelled
              const rowKey = `script:${key}`;
              if (cancelled && cancelledKeys.has(rowKey)) return;
              const rel = relative(cwd, outFileAbs).replace(/\\/g, '/');
              renderer?.update(
                rowKey,
                {
                  kind: 'done',
                  durationMs: Math.max(0, endedAt - startedAt),
                  outputPath: rel,
                },
                { type: 'script', item: key },
              );
            },
            silent: true,
          }
        : undefined,
      renderer ? { silent: true } : undefined,
      () => !cancelled,
      supervisor,
    );
    created.push(...scriptOutputs);
  }

  // ARCHIVE PHASE
  if (behavior.archive && !cancelled) {
    const includeOutputs = Boolean(behavior.combine);
    const { archivePath, diffPath } = await archivePhase(
      {
        cwd,
        config,
        includeOutputs,
      },
      renderer
        ? {
            // Live updates and silent console logging (suppress legacy start/done lines)
            silent: true,
            progress: {
              start: (kind: 'full' | 'diff') => {
                const key = kind === 'full' ? 'archive:full' : 'archive:diff';
                renderer?.update(
                  key,
                  { kind: 'running', startedAt: Date.now() },
                  {
                    type: 'archive',
                    item: kind === 'full' ? 'full' : 'diff',
                  },
                );
              },
              done: (
                kind: 'full' | 'diff',
                pathAbs: string,
                startedAt: number,
                endedAt: number,
              ) => {
                const key = kind === 'full' ? 'archive:full' : 'archive:diff';
                const rel = relative(cwd, pathAbs).replace(/\\/g, '/');
                renderer?.update(key, {
                  kind: 'done',
                  durationMs: Math.max(0, endedAt - startedAt),
                  outputPath: rel,
                });
              },
            },
          }
        : undefined,
    );
    created.push(archivePath, diffPath);
  }

  // Stop live renderer (no-op render) if it was started.
  if (renderer) {
    // Flush one final frame so the most recent states are included
    renderer.flush();
    renderer.stop();
  }

  // Always restore keypress/SIGINT wiring
  const toRestore = restoreCancel;
  restoreCancel = null; // Nullify immediately
  if (typeof toRestore === 'function') {
    try {
      toRestore();
    } catch {
      /* ignore */
    }
  }

  // Exit non‑zero when cancelled (service-level best-effort)
  if (cancelled) {
    try {
      process.exitCode = 1;
      // In CLI usage, exit promptly after cancelling children and stopping
      // the live renderer. Avoid hard exit during tests.
      if (process.env.NODE_ENV !== 'test') {
        // Best-effort immediate exit to return control to the shell.
        // Children have already been signaled via supervisor.cancelAll().
        process.exit(1);
      }
    } catch {
      /* ignore */
    }
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
