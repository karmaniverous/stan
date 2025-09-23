# STAN Development Plan

When updated: 2025-09-23 (UTC)

Next up (priority order)

1. Targeted unit coverage - Add/keep small unit tests where integration coverage is thin: - Packaged prompt path resolution (getPackagedSystemPromptPath).
   - System monolith assembly edge cases (already covered partially).
2. CI stability monitoring (Windows)
   - Continue watching for teardown flakiness; keep stdin pause + cwd reset + brief settle pattern; adjust as needed.

3. Gen‑system hygiene
   - Config discovery already reuses centralized helpers; periodically review to avoid drift if related code evolves.

Backlog (nice to have)

- Optional compression research (keep canonical artifacts as plain .tar).
- Additional doc cross‑checks to keep CLI help and site pages in sync.

Completed (recent)

- Init: remove redundant reset-diff prompt
  - Eliminate the interactive “Reset diff snapshot now?” question from `stan init`.
  - Snapshot behavior is now:
    - If no snapshot exists, create it without asking.
    - If a snapshot exists, ask “Keep existing snapshot?” (default Yes). If the user answers “No”, replace it.
- Typecheck/docs build fix: resolve TS2339 in run action
  - Load config as ContextConfig in src/cli/stan/run/action.ts and keep the debug fallback; remove the narrow type guard that hid optional properties (cliDefaults). This unblocks build, docs, and typecheck.
- Live run UX: print a trailing newline after `stan run --live` exits so the shell prompt resumes on a clean line.
- Cancel parity (Windows) stability: increase settle delay after cancellation to give child processes time to terminate
  before test teardown removes temp directories (reduces EBUSY/ENOTEMPTY during rm of temp dirs).

- Windows test stability: cancel parity teardown
  - In src/stan/run/cancel.parity.test.ts, leave the temp directory before rm, pause stdin, and wait briefly to avoid EBUSY on rmdir. Mirrors the stability pattern used elsewhere and removes the last flake in this suite.
- CLI defaults: support run.plan; plan header default now respects cliDefaults.run.plan (default true). Action wiring keeps -p (plan-only) and -P (no plan) semantics unchanged.
- Cancellation tests stability (Windows): add brief settle before returning on cancel to avoid EBUSY/ENOTEMPTY on rm of temp dirs.

- Patch CLI test teardown stability (Windows)
  - In src/cli/stan/patch.test.ts, pause stdin and allow a brief settle before removing the temp dir in afterEach to prevent EBUSY/timeout flakes (mirrors the pattern used in openFilesInEditor tests).

- Lint fix (LoggerUI.onCancelled)
  - Remove “unused param” lint by referencing the optional mode parameter (void mode) to satisfy @typescript-eslint/no-unused-vars.
- Live-mode cancel final-frame persistence
  - Pressing q now leaves the final live frame visible (persisted) instead of clearing it. Restart (r) still clears the frame so the next run reuses the same UI area without duplication.
- Live restart immediate cancel
  - Pressing r in --live now cancels all running child processes immediately (TERM -> KILL without grace) and restarts the run without waiting for tasks to settle. Previously, tasks could continue executing in the background and restart was delayed. Implementation races script execution against a cancel/restart signal.
- Live UI restart uses the same UI
  - On restart, clear the previous live frame (via log-update clear) instead of persisting it. This prevents the live table from appearing twice (the old persisted frame plus the new one) and ensures the restart happens “in the same UI” as expected.- Live UI restart key
  - In --live mode, added r/R to restart the run. Pressing r cancels current processes without exiting and re-runs immediately in the same session. Hint updated to “Press q to cancel, r to restart” with bold “r” in non-boring mode.
- No-live LoggerUI status parity with live UI
  - LoggerUI now emits the same status labels and colors as the live table: waiting/run/ok/fail (error)/cancelled/quiet/stalled/timeout/killed. - Adds a “waiting” line when scripts are queued for execution.

- Colorize no-live LoggerUI console logs by status
  - start -> blue; done (success) -> green; done (failure) -> red.
  - Applies to script and archive start/done lines in non-TTY runs.
- Mitigate Windows EBUSY/ENOTEMPTY in openFilesInEditor tests
  - Log “open -> …” before attempting any spawn.
  - In tests (NODE_ENV=test), skip the actual spawn to avoid transient locks on the temp directory.
  - Behavior remains observable in logs without launching real processes or windows.
