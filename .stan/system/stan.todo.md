# STAN Development Plan

When updated: 2025-09-23 (UTC)

Next up (priority order)
1. Targeted unit coverage
   - Add/keep small unit tests where integration coverage is thin:
     - Packaged prompt path resolution (getPackagedSystemPromptPath).
     - System monolith assembly edge cases (already covered partially).

2. CI stability monitoring (Windows)
   - Continue watching for teardown flakiness; keep stdin pause + cwd reset + brief settle pattern; adjust as needed.

3. Gen‑system hygiene
   - Config discovery already reuses centralized helpers; periodically review to avoid drift if related code evolves.

Backlog (nice to have)

- Optional compression research (keep canonical artifacts as plain .tar).
- Additional doc cross‑checks to keep CLI help and site pages in sync.

Completed (recent)

- No-live LoggerUI status parity with live UI
  - LoggerUI now emits the same status labels and colors as the live table:
    waiting/run/ok/fail (error)/cancelled/quiet/stalled/timeout/killed.
  - Adds a “waiting” line when scripts are queued for execution.

- Colorize no-live LoggerUI console logs by status
  - start -> blue; done (success) -> green; done (failure) -> red.
  - Applies to script and archive start/done lines in non-TTY runs.
- Mitigate Windows EBUSY/ENOTEMPTY in openFilesInEditor tests
  - Log “open -> …” before attempting any spawn.
  - In tests (NODE_ENV=test), skip the actual spawn to avoid transient locks on the temp directory.
  - Behavior remains observable in logs without launching real processes or windows.