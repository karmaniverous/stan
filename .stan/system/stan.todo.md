# STAN Development Plan

When updated: 2025-09-23 (UTC)

Next up (priority order)

1. Stabilize Windows EBUSY/ENOTEMPTY in openFilesInEditor test
   - Symptom: intermittent EBUSY on temp dir removal in src/stan/patch/open.test.ts (afterEach).
   - Actions:
     - Ensure cwd is outside the temp dir before rm (already attempted).
     - Consider slightly longer settle delay and/or rimraf with retries.
     - Recheck stdin.pause() timing and any lingering handles.

2. Targeted unit coverage
   - Add/keep small unit tests where integration coverage is thin:
     - Packaged prompt path resolution (getPackagedSystemPromptPath).
     - System monolith assembly edge cases (already covered partially).

3. CI stability monitoring (Windows)
   - Continue watching for teardown flakiness; keep stdin pause + cwd reset + brief settle pattern; adjust as needed.

4. Gen‑system hygiene
   - Config discovery already reuses centralized helpers; periodically review to avoid drift if related code evolves.

Backlog (nice to have)

- Optional compression research (keep canonical artifacts as plain .tar).
- Additional doc cross‑checks to keep CLI help and site pages in sync.
