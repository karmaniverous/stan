import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { ContextConfig } from '@/stan/config';
import { ensureOutputDir } from '@/stan/config';

import { makeStanDirs } from '../paths';
import { preflightDocsAndVersion } from '../preflight';
import { magenta, red } from '../util/color';
import { archivePhase } from './archive';
import { runScripts } from './exec';
import { ProcessSupervisor } from './live/supervisor';
import { renderRunPlan } from './plan';
import type { ExecutionMode, RunBehavior } from './types';
import { LiveUI, LoggerUI, type RunnerUI } from './ui';
const shouldWriteOrder =
  process.env.NODE_ENV === 'test' || process.env.STAN_WRITE_ORDER === '1';

/**
 * High‑level runner for `stan run`.
 *
 * Responsibilities:
 * - Preflight docs/version (best‑effort).
 * - Ensure output/diff directories.
 * - Print the run plan.
 * - Execute selected scripts (in the chosen mode).
 * - Optionally create regular and diff archives (combine/keep behaviors). * @param cwd - Repo root for execution.
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
  // Preflight docs/version (non-blocking; best-effort)
  let hadFailures = false;
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

  // Multi-line plan summary (delegated to UI a few lines below)
  const planBody = renderRunPlan(cwd, {
    selection,
    config,
    mode,
    behavior,
  });

  // TTY-only live UI (otherwise legacy logger UI)
  const stdoutLike = process.stdout as unknown as { isTTY?: boolean };
  const isTTY = Boolean(stdoutLike?.isTTY);
  const liveEnabled = (behavior.live ?? true) && isTTY;

  let printedPlan = false;
  // Outer loop: allow a live-mode restart (r) to re-run once per trigger.
  // Each iteration rewires UI and process supervision from a clean slate.
  for (;;) {
    hadFailures = false;
    let cancelled = false;
    // Signal to break out of the current run loop immediately on cancel/restart
    let wakeCancelOrRestart: (() => void) | null = null;
    const cancelOrRestart = new Promise<void>((resolveWake) => {
      wakeCancelOrRestart = resolveWake;
    });
    let restartRequested = false;
    const supervisor = new ProcessSupervisor({
      hangWarn: behavior.hangWarn,
      hangKill: behavior.hangKill,
      hangKillGrace: behavior.hangKillGrace,
    });

    let orderFile: string | undefined;
    if (shouldWriteOrder) {
      orderFile = resolve(outAbs, 'order.txt');
      if (!behavior.keep) {
        await writeFile(orderFile, '', 'utf8');
      }
    }

    const ui: RunnerUI = liveEnabled
      ? new LiveUI({ boring: process.env.STAN_BORING === '1' })
      : new LoggerUI();

    // Print plan and one trailing blank line to keep previous spacing semantics
    if (!printedPlan && behavior.plan !== false) {
      ui.onPlan(planBody);
      console.log('');
      printedPlan = true;
    }
    ui.start();

    // Build the run list:
    // - When selection is null/undefined, run all scripts in config order.  // - When selection is provided (even empty), respect the provided order.
    const selected =
      selection == null ? Object.keys(config.scripts) : selection;
    // Filter to known script keys to avoid spawning undefined commands.
    const toRun = selected.filter((k) =>
      Object.prototype.hasOwnProperty.call(config.scripts, k),
    );

    // Pre-register all planned rows as "waiting" so the UI shows the full schedule at start.
    // Scripts:
    for (const k of toRun) {
      ui.onScriptQueued(k);
    }
    // Archives (when enabled):
    if (behavior.archive) {
      ui.onArchiveQueued('full');
      ui.onArchiveQueued('diff');
    }

    // Track cancelled keys to avoid late "done" flips after cancellation
    const cancelledKeys = new Set<string>();

    // Idempotent cancellation pipeline
    const triggerCancel = (): void => {
      if (cancelled) return;
      cancelled = true; // Mark and finalize UI; escalate processes immediately
      for (const k of toRun) cancelledKeys.add(`script:${k}`);
      // Stop live renderer / restore stdin and remove listeners best‑effort
      try {
        ui.onCancelled();
      } catch {
        /* ignore */
      }
      // Send TERM → immediate KILL escalation to all tracked children
      try {
        supervisor.cancelAll({ immediate: true });
      } catch {
        /* ignore */
      }
      // Return control to the shell immediately in real CLI runs.
      // Tests keep the process alive to allow assertions.
      try {
        wakeCancelOrRestart?.();
      } catch {
        /* ignore */
      }
      try {
        process.exitCode = 1;
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
      } catch {
        /* ignore */
      }
    };
    // Live-mode restart: cancel immediately, but do not set exitCode or exit the process.
    const triggerRestart = (): void => {
      if (restartRequested) return;
      restartRequested = true;
      cancelled = true;
      try {
        ui.onCancelled();
      } catch {
        /* ignore */
      }
      try {
        supervisor.cancelAll({ immediate: true });
      } catch {
        /* ignore */
      }
      try {
        wakeCancelOrRestart?.();
      } catch {
        /* ignore */
      }
      // intentionally do not set process.exitCode or exit here
    };
    // Install cancel keys (q/Ctrl+C) + SIGINT parity via UI (no-op for LoggerUI)
    ui.installCancellation(
      triggerCancel,
      liveEnabled ? triggerRestart : undefined,
    );
    const created: string[] = [];
    // Run scripts only when selection non-empty
    if (toRun.length > 0) {
      const outRel = dirs.outputRel;
      // Start scripts and collect outputs as they finish. Race against cancel/restart
      // so we do not wait for all children to settle when the user hits 'r'.
      const collect = runScripts(
        cwd,
        outAbs,
        outRel,
        config,
        toRun,
        mode,
        orderFile,
        {
          onStart: (key) => {
            ui.onScriptStart(key);
          },
          onEnd: (key, outFileAbs, startedAt, endedAt, code) => {
            if (cancelled && cancelledKeys.has(`script:${key}`)) return;
            ui.onScriptEnd(key, outFileAbs, cwd, startedAt, endedAt, code);
            if (typeof code === 'number' && code !== 0) hadFailures = true;
          },
          silent: true,
          // In no-live mode, surface hang events as concise console logs.
          onHangWarn: (key, seconds) => {
            if (!liveEnabled) {
              console.log(
                `stan: ${magenta('stalled')} "${key}" after ${seconds.toString()}s of inactivity`,
              );
            }
          },
          onHangTimeout: (key, seconds) => {
            if (!liveEnabled) {
              console.log(
                `stan: ${red('timeout')} "${key}" after ${seconds.toString()}s; sending SIGTERM`,
              );
            }
          },
          onHangKilled: (key, grace) => {
            if (!liveEnabled) {
              console.log(
                `stan: ${red('killed')} "${key}" after ${grace.toString()}s grace`,
              );
            }
          },
        },
        {
          silent: true,
          hangWarn: behavior.hangWarn,
          hangKill: behavior.hangKill,
          hangKillGrace: behavior.hangKillGrace,
        } as unknown as {
          silent?: boolean;
          hangWarn?: number;
          hangKill?: number;
          hangKillGrace?: number;
        },
        () => !cancelled,
        supervisor,
      ).then((outs) => {
        created.push(...outs);
      });
      // Prevent unhandled rejections if we abandon the await on cancel/restart.
      void collect.catch(() => {});
      await Promise.race([collect, cancelOrRestart]);
    }

    // If the user cancelled (q/Ctrl+C/SIGINT), skip any further work (including
    // archiving) and return immediately. This guarantees no archives are created
    // post‑cancel in either live or no‑live modes and aligns with test parity.
    if (cancelled) {
      try {
        ui.stop();
      } catch {
        /* ignore */
      }
      // Live restart: loop and run again; non-live or explicit cancel: return.
      if (restartRequested) {
        // next iteration
        continue;
      }
      return created;
    }
    // If any script failed (exit code != 0), signal failure at the process level.
    // Archives are still produced to preserve artifacts for chat/diagnosis.
    if (hadFailures) {
      process.exitCode = 1;
    }
    // ARCHIVE PHASE
    if (behavior.archive && !cancelled) {
      const includeOutputs = Boolean(behavior.combine);
      const { archivePath, diffPath } = await archivePhase(
        { cwd, config, includeOutputs },
        {
          silent: true,
          progress: {
            start: (kind: 'full' | 'diff') => {
              ui.onArchiveStart(kind);
            },
            done: (
              kind: 'full' | 'diff',
              pathAbs: string,
              startedAt: number,
              endedAt: number,
            ) => {
              ui.onArchiveEnd(kind, pathAbs, cwd, startedAt, endedAt);
            },
          },
        },
      );
      created.push(archivePath, diffPath);
    }

    // Stop UI (flush/teardown for live; no-op for logger UI).
    ui.stop();

    // UI teardown moved into ui.stop()/onCancelled()

    // Exit non‑zero when cancelled (service-level best-effort)
    if (cancelled) {
      // handled above; defensive no-op
    }
    return created;
  } // end for(;;) loop
};
