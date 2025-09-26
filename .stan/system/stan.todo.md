# STAN Development Plan

When updated: 2025-09-26 (UTC)

Next up (priority order)

- Class‑based design adoption audit
  - Apply the new project policy: prefer class‑based design wherever possible.
  - For touched modules, prefer introducing small single‑responsibility classes that fit existing ports/adapters seams.
  - Do not refactor purely for style; convert opportunistically with functional changes, and record any follow‑ups as needed.

- Cancellation pipeline hardening (failing tests)
  - cancel.schedule: sequential scheduling must not run the next script after SIGINT.
    - Proposal: gate per‑script execution with a per‑script race (runner vs cancel), and check the cancellation flag again immediately after each runner resolves to prevent the next schedule step from starting.
    - Add a dedicated unit/integration test for the per‑script race to keep this behavior pinned.
  - cancel.key (Windows): sporadic EBUSY on teardown in CI.
    - Proposal: increase the post‑cancel settle slightly or wire a brief bounded join on renderer timers; keep rmDirWithRetries as last resort.
    - Validate locally and in CI to tune the final settle back toward 250–500 ms.

- CLI UI unification (Live + Logger under one composable UI)
  - Provide a single RunnerUI that composes a shared ProgressModel and a pluggable sink (LiveTableSink | LoggerSink).
  - Share status labels and summary via one helper; preserve q/r keys, final‑frame flush, and parity with existing tests.
  - Acceptance: existing live/no‑live parity tests remain green; logs/frames carry the same status tokens.

- DRY status labels and summary
  - Extract a shared status‑label + summary helper and reuse in LoggerUI and ProgressRenderer to avoid wording/color drift.

- Archive constants
  - Introduce ARCHIVE_BASENAME/ARCHIVE_TAR/ARCHIVE_DIFF_TAR constants and reuse across util/output/archive/diff (and tests) instead of string literals.

- Shared repo‑relative path validator
  - Consolidate the “normalize + forbid absolute + forbid ..” checks used by File Ops (patch/file‑ops.ts) and the response validator (validate/response.ts) into one utility.

- Reserved workspace exclusions (single source)
  - Centralize exclusion rules for <stanPath>/diff and <stanPath>/patch (and output when not combined) in a tiny helper used by filterFiles() and makeTarFilter().

- openFilesInEditor test gating
  - Decide on STAN_FORCE_OPEN policy: either honor it in openFilesInEditor or remove it from tests; align both to one rule.

- RunnerControl ‘data’ fallback
  - Re‑evaluate after broader CI coverage; remove if redundant to reduce surface area.

- Cancel settle time
  - Reduce the post‑cancel final settle from 1200 ms toward ~250–500 ms if real‑world runs remain stable.

- Optional: subcommand harness
  - Small helper to DRY Commander wiring (safety adapters, footer) across run/init/snap/patch.

- Test teardown helpers
  - Centralize stdin pause and short settle via src/test/helpers; drop per‑test duplicates to avoid Windows EBUSY flakes.

- Imports staging: label sanitizer helper (optional)
  - Factor label/tail sanitizer to a tiny shared helper for future reuse if staging expands.

- buildApplyAttempts: remove unused ‘stage’ param
  - Pipeline is worktree‑first; drop dead parameter and simplify types.

- DMP readiness (follow‑on)
  - When DMP apply lands, feed its stderr/summary through the same formatter and share the envelopes with diff/file ops behavior.

- Codebase reduction
  - Identify and eliminate dead or duplicated code where safe; prefer reuse of shared helpers.

- Adopt explicit dev‑mode diagnostics triage in project prompt
  - Analyze → ask → apply or listings; gate patch emission on explicit approval.

- DMP rung (formatter extension)
  - Include a DMP attempt line and reasons alongside git/jsdiff in the diagnostics envelope (prep for DMP apply).

- Minor polish:
  - Audit other diagnostics call‑sites for reuse of the shared helpers.
  - Consider a brief docs note in README about full vs diff archive contents (patch workspace policy).

Completed (recent)

- Live BORING labels — bracket tokens
  - Unify Live’s BORING tokens to bracketed form ([OK]/[FAIL]/…) using the shared label helper.
  - Fixes the final‑frame expectation in live.order.flush.test without changing non‑TTY/TTY behavior.
  - Follow‑up: finish DRY by switching Logger to the same helper and removing its local duplicate.

- Logger status labels — DRY via shared helper
  - Switched the Logger UI to use the shared status‑label helper and removed its local duplicate.
  - Maintains parity with Live; BORING tokens remain bracketed and stable; TTY colored symbols preserved where applicable.

- Windows cancel teardown — additional EBUSY hardening
  - Increased final post‑cancel settle on Windows to 1600 ms (non‑Windows 400 ms) to further reduce transient EBUSY during test directory removal.

- Windows cancel teardown — EBUSY hardening
  - Extended default backoff in rmDirWithRetries to [50, 100, 200, 400, 800, 1600] ms to better tolerate transient rmdir EBUSY on Windows CI.
  - Updated cancel.schedule.test.ts to use rmDirWithRetries in afterEach (was direct rm).
  - Goal: reduce remaining cancellation‑path flakes without increasing session settle time.

- Project policy — class‑based design directive
  - Added a project‑level directive to prefer a class‑based design wherever possible.
  - Guidance: single‑responsibility classes, ports/adapters alignment, compositional preference, opportunistic migration, and paired tests.
