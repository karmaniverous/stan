import { writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

import type { ContextConfig } from '@/stan/config';
import { ensureOutputDir } from '@/stan/config';

import { makeStanDirs } from '../paths';
import { preflightDocsAndVersion } from '../preflight';
import { archivePhase } from './archive';
import { runScripts } from './exec';
import { ProcessSupervisor, ProgressRenderer } from './live';
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
  // TTY key handler (q/Q or Ctrl+C) → single, idempotent cancellation pipeline
  let restoreTty: (() => void) | null = null;
  const installKeyHandlers = (): void => {
    try {
      const stdin = process.stdin as unknown as NodeJS.ReadStream & {
        setRawMode?: (v: boolean) => void;
      };
      if (!stdin) return;
      const isTty = Boolean(stdin.isTTY);
      // SIGINT parity always enabled
      const onSigint = () => triggerCancel();
      process.on('SIGINT', onSigint);
      if (!isTty) {
        restoreTty = () => {
          process.off('SIGINT', onSigint);
        };
        return;
      }
      stdin.setEncoding('utf8');
      // Some environments omit setRawMode; guard accordingly
      try {
        stdin.setRawMode?.(true);
      } catch {
        /* ignore */
      }
      stdin.resume();
      const onData = (data: string) => {
        if (!data) return;
        if (data === '\u0003' /* Ctrl+C */ || data.toLowerCase() === 'q') {
          triggerCancel();
        }
      };
      stdin.on('data', onData);
      restoreTty = () => {
        try {
          stdin.off('data', onData);
        } catch {
          /* ignore */
        }
        try {
          stdin.setRawMode?.(false);
        } catch {
          /* ignore */
        }
        try {
          // Ensure the stream no longer holds the event loop open.
          (stdin as unknown as { pause?: () => void }).pause?.();
        } catch {
          /* ignore */
        }
        process.off('SIGINT', onSigint);
      };
    } catch {
      /* best-effort */
    }
  };
  // TTY-only live renderer (scaffold; no-op when not TTY or disabled)
  const stdoutLike = process.stdout as unknown as { isTTY?: boolean };
  const isTTY = Boolean(stdoutLike?.isTTY);
  const liveEnabled = (behavior.live ?? true) && isTTY;
  // Future: wire ProgressRenderer + ProcessSupervisor when liveEnabled === true.
  let renderer: ProgressRenderer | undefined;
  if (liveEnabled) {
    renderer = new ProgressRenderer({
      boring: process.env.STAN_BORING === '1',
    }); // Pre-register archive rows when we intend to archive, so the UI    // shows them as "waiting" while scripts are running.
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
    // Install key handlers only in TTY live mode
    installKeyHandlers();
  }

  // Build the run list:  // - When selection is null/undefined, run all scripts in config order.
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

  const triggerCancel = (): void => {
    if (cancelled) return;
    cancelled = true;
    if (renderer) {
      // Update live rows to cancelled (best-effort durations)
      for (const k of toRun) {
        const rowKey = `script:${k}`;
        // Mark row as cancelled to prevent later "done" overwrite
        cancelledKeys.add(rowKey);
        renderer.update(rowKey, { kind: 'cancelled', durationMs: 0 });
      }
      renderer.update('archive:full', { kind: 'cancelled', durationMs: 0 });
      renderer.update('archive:diff', { kind: 'cancelled', durationMs: 0 });
      renderer.flush();
    }
    // Signal processes and escalate after grace
    supervisor.cancelAll();
  };
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
              // If we missed an earlier mark, fall back to "now"
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
    // Flush one final frame so the most recent states (e.g., archive diff ✔ ok)
    // are included before persisting via stop().
    renderer.flush();
    renderer.stop();
  }

  // Always restore TTY state/listeners
  try {
    // Copy to a local and use a simple truthy guard to avoid plugin/transformer narrowing issues.
    const rt = restoreTty;
    if (rt) {
      rt();
    }
  } catch {
    /* ignore */
  } finally {
    restoreTty = null;
  } // Exit non‑zero when cancelled (service-level best-effort)
  if (cancelled) {
    try {
      process.exitCode = 1;
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
