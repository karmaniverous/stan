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

- Live-mode cancel final-frame persistence
  - Pressing q now leaves the final live frame visible (persisted) instead of clearing it.
    Restart (r) still clears the frame so the next run reuses the same UI area without duplication.

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
