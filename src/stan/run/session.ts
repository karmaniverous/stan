// src/stan/run/session.ts
/**
 * One-shot run session (single attempt).
 * - Windows EBUSY hardening: add a slightly longer final settle after cancellation.
 * - Wires live/no-live UI, cancellation keys (q / Ctrl+C), and restart (r in live).
 * - Schedules scripts (concurrent|sequential) and optionally runs the archive phase.
 * - Preserves all existing logging semantics: *   - Plan printing is driven by the caller via printPlan + planBody.
 *   - Live mode renders the progress table; legacy "stan: start/done" archive
 *     lines remain suppressed.
 *   - No-live mode prints concise status lines.
 * - Returns created artifact paths and signals cancellation or restart.
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { ContextConfig } from '@/stan/config';
import { makeStanDirs } from '@/stan/paths';

import { archivePhase } from './archive';
import { runScripts } from './exec';
import { ProcessSupervisor } from './live/supervisor';
import type { ExecutionMode, RunBehavior } from './types';
import { LiveUI, LoggerUI, type RunnerUI } from './ui';

const shouldWriteOrder =
  process.env.NODE_ENV === 'test' || process.env.STAN_WRITE_ORDER === '1';

export const runSessionOnce = async (args: {
  cwd: string;
  config: ContextConfig;
  selection: string[];
  mode: ExecutionMode;
  behavior: RunBehavior;
  liveEnabled: boolean;
  planBody?: string;
  printPlan?: boolean;
}): Promise<{
  created: string[];
  cancelled: boolean;
  restartRequested: boolean;
}> => {
  const {
    cwd,
    config,
    selection,
    mode,
    behavior,
    liveEnabled,
    planBody,
    printPlan,
  } = args;

  const dirs = makeStanDirs(cwd, config.stanPath);
  const outAbs = dirs.outputAbs;
  const outRel = dirs.outputRel;

  const ui: RunnerUI = liveEnabled
    ? new LiveUI({ boring: process.env.STAN_BORING === '1' })
    : new LoggerUI();

  // Optional order file (tests)
  let orderFile: string | undefined;
  if (shouldWriteOrder) {
    orderFile = resolve(outAbs, 'order.txt');
    if (!behavior.keep) {
      await writeFile(orderFile, '', 'utf8');
    }
  }

  // Print plan once per outer loop (delegated by caller)
  if (printPlan && planBody) {
    ui.onPlan(planBody);
    // Preserve a trailing blank line after the plan (legacy spacing)
    console.log('');
  }

  ui.start();

  // Build run list and pre-register UI rows so table shows full schedule up front
  const toRun = (selection ?? []).filter((k) =>
    Object.prototype.hasOwnProperty.call(config.scripts, k),
  );
  for (const k of toRun) {
    ui.onScriptQueued(k);
  }
  if (behavior.archive) {
    ui.onArchiveQueued('full');
    ui.onArchiveQueued('diff');
  }

  // Cancellation/restart wiring
  const supervisor = new ProcessSupervisor({
    hangWarn: behavior.hangWarn,
    hangKill: behavior.hangKill,
    hangKillGrace: behavior.hangKillGrace,
  });
  let cancelled = false;
  let restartRequested = false;
  const cancelledKeys = new Set<string>();
  let wakeCancelOrRestart: (() => void) | null = null;
  const cancelOrRestart = new Promise<void>((resolveWake) => {
    wakeCancelOrRestart = resolveWake;
  });

  const triggerCancel = (): void => {
    if (cancelled) return;
    cancelled = true;
    for (const k of toRun) cancelledKeys.add(`script:${k}`);
    try {
      ui.onCancelled('cancel');
    } catch {
      /* ignore */
    }
    try {
      supervisor.cancelAll({ immediate: true });
    } catch {
      /* ignore */
    }
    try {
      process.exitCode = 1;
      if (process.env.NODE_ENV !== 'test') process.exit(1);
    } catch {
      /* ignore */
    }
    try {
      wakeCancelOrRestart?.();
    } catch {
      /* ignore */
    }
  };

  const triggerRestart = (): void => {
    if (restartRequested) return;
    restartRequested = true;
    cancelled = true;
    try {
      ui.onCancelled('restart');
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
  };

  // Keys: live wires restart; logger wires SIGINT parity only
  ui.installCancellation(
    triggerCancel,
    liveEnabled ? triggerRestart : undefined,
  );

  const created: string[] = [];
  let collectPromise: Promise<void> | null = null;
  // Run scripts (if any)
  if (toRun.length > 0) {
    collectPromise = runScripts(
      cwd,
      outAbs,
      outRel,
      config,
      toRun,
      mode,
      orderFile,
      {
        onStart: (key) => ui.onScriptStart(key),
        onEnd: (key, outFileAbs, startedAt, endedAt, code) => {
          if (cancelled && cancelledKeys.has(`script:${key}`)) return;
          ui.onScriptEnd(key, outFileAbs, cwd, startedAt, endedAt, code);
          if (typeof code === 'number' && code !== 0) process.exitCode = 1;
        },
        silent: true,
        onHangWarn: (key, seconds) => {
          if (!liveEnabled) {
            console.log(
              `stan: ⏱ stalled "${key}" after ${seconds}s of inactivity`,
            );
          }
        },
        onHangTimeout: (key, seconds) => {
          if (!liveEnabled) {
            console.log(
              `stan: ⏱ timeout "${key}" after ${seconds}s; sending SIGTERM`,
            );
          }
        },
        onHangKilled: (key, grace) => {
          if (!liveEnabled) {
            console.log(`stan: ◼ killed "${key}" after ${grace}s grace`);
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
    void collectPromise.catch?.(() => {});
    await Promise.race([collectPromise, cancelOrRestart]);
  }

  // Cancellation short-circuit (skip archives)
  if (cancelled) {
    try {
      ui.stop();
    } catch {
      /* ignore */
    }
    if (liveEnabled) {
      console.log('');
    }
    try {
      if (collectPromise) {
        await Promise.race([
          collectPromise,
          new Promise((r) => setTimeout(r, 2500)),
        ]);
      }
    } catch {
      /* ignore */
    }
    try {
      await supervisor.waitAll(3000);
    } catch {
      /* ignore */
    }
    try {
      (process.stdin as unknown as { pause?: () => void }).pause?.();
    } catch {
      /* ignore */
    }
    try {
      // Final settle before teardown (Windows EBUSY mitigation)
      // Empirically, increasing this from 800ms to 1200ms reduces transient
      // rmdir ENOTEMPTY/EBUSY in test teardown after SIGINT-driven cancellation.
      // This is a bounded, best-effort delay that does not impact non-Windows runs.
      await new Promise((r) => setTimeout(r, 1200));
    } catch {
      /* ignore */
    }
    return { created, cancelled: true, restartRequested };
  }
  // ARCHIVE PHASE
  if (behavior.archive) {
    const includeOutputs = Boolean(behavior.combine);
    const { archivePath, diffPath } = await archivePhase(
      { cwd, config, includeOutputs },
      {
        silent: true,
        progress: {
          start: (kind) => ui.onArchiveStart(kind),
          done: (kind, pathAbs, startedAt, endedAt) =>
            ui.onArchiveEnd(kind, pathAbs, cwd, startedAt, endedAt),
        },
      },
    );
    created.push(archivePath, diffPath);
  }

  ui.stop();
  if (liveEnabled) {
    console.log('');
  }
  return { created, cancelled: false, restartRequested };
};
