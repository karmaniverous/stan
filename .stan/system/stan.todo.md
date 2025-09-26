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

- Live/Logger status labels DRY & parity
  - Now that Live uses bracketed BORING tokens via the shared helper, switch Logger to the same helper and delete the local duplicate in ui.ts.
  - Keep colored symbol labels for TTY while retaining bracketed tokens for BORING/non‑TTY.
  - Acceptance: existing alignment/parity tests pass with stable tokens.

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

Unpersisted tasks

- Extend formatter to incorporate future DMP rung (produce a DMP attempt line + reasons alongside git/jsdiff).
- Minor polish:
  - Audit other diagnostics call‑sites for reuse of the shared helpers.
  - Consider a brief docs note in README about full vs diff archive contents (patch workspace policy).

Completed (recent)

- Live BORING labels — bracket tokens
  - Unify Live’s BORING tokens to bracketed form ([OK]/[FAIL]/…) using the shared label helper.
  - Fixes the final‑frame expectation in live.order.flush.test without changing non‑TTY/TTY behavior.
  - Follow‑up: finish DRY by switching Logger to the same helper and removing its local duplicate.

- Windows cancel teardown — EBUSY hardening
  - Extended default backoff in rmDirWithRetries to [50, 100, 200, 400, 800, 1600] ms to better tolerate transient rmdir EBUSY on Windows CI.
  - Updated cancel.schedule.test.ts to use rmDirWithRetries in afterEach (was direct rm).
  - Goal: reduce remaining cancellation‑path flakes without increasing session settle time.

- Project policy — class‑based design directive
  - Added a project‑level directive to prefer a class‑based design wherever possible.
  - Guidance: single‑responsibility classes, ports/adapters alignment, compositional preference, opportunistic migration, and paired tests.

- Cancel pipeline — SIGINT parity fix
  - Parity test passing; archives skipped on cancel; bounded settle/join in place. Consider reducing the final settle once real‑world runs validate stability.

- CLI refactor complete:
  - New run options/action/derive/defaults modules; help footer and defaults wiring; conflict handling; safety adapters applied consistently.
  - Behavior parity verified by tests (live/no‑live, defaults, conflicts, help).

- Added signal-exit central exit hook and simplified cancellation wiring:
  - session: single SIGINT listener (parity); single exit hook for teardown.
  - LoggerUI: removed SIGINT wiring (relies on session).
  - RunnerControl: keys-only (q/r); no SIGINT path.
  - Tests remain green; behavior unchanged for users (q/r/Ctrl+C; archives skipped on cancel).

- Validated diffs for ops‑only acceptance (no full listings):
  - Reissued correct unified diffs for new test and doc updates.

- Live cancellation consolidation:
  - Introduced src/stan/run/control.ts (RunnerControl) using Node readline + SIGINT; centralizes q/r/Ctrl+C and teardown.
  - LoggerUI/LiveUI now attach/detach RunnerControl; raw‑mode and listeners are restored in one place; archives remain skipped on cancel; exitCode set.
  - Removed legacy key handler via File Ops:
    - rm src/stan/run/input/keys.ts
  - Rationale: shrink cancellation surface to a single small controller and delete code quickly without changing UX or tests.

- Lint clean-up:
  - Removed dead constant-condition block in src/stan/patch/service.ts (no-constant-condition).

- Patch workspace policy: exclude from ALL archives (full and diff).
  - Code: filterFiles and tar filter updated; bootstrap archiver excludes .stan/patch.
  - Tests: combine archive behavior updated (no patch dir); fixed regex escaping in attempts[] integration test.
  - Docs: project prompt updated to reflect exclusion in all archives.

- Extracted and deduplicated diagnostics helpers:
  - Added src/stan/patch/diag/util.ts with AttemptLabel, firstStderrLine, and renderAttemptSummary.
  - Refactored src/stan/patch/format.ts to use the shared helpers; removed local logic duplication.

- Added integration test to assert attempts[] summary order appears for git apply failures across p1→p0:
  - src/stan/patch/service.attempts.integration.test.ts

- Patch failure output alignment (tests):
  - Downstream (diff): one-liners now end with "was invalid." (no trailing listing request text in-line). Multiple failures remain blank-line separated. Tests assert for "invalid.\n\nThe unified diff..." spacing.
  - STAN (file ops): parse-diagnostics lines normalized to "file-ops …" to match diagnostics-envelope expectations in tests.

- Test alignment:
  - Updated service.failure-prompt-path test to expect the new downstream diff one-liner ending with "was invalid." (no inline listing request).

- Patch failure prompt path fix:
  - Clipboard/stdout prompt now uses the actual file path instead of "(patch)" when jsdiff reports a generic parse error. The service falls back to header-derived paths when jsdiff does not provide concrete file names.

- File Ops payload alignment:
  - Updated parser/validator/service to accept an unfenced “### File Ops” block (lines after heading up to the next heading); removed fence handling.
  - Adjusted tests accordingly; clarified docs to remove “fenced” wording.

- Persist raw patch for manual reprocessing:
  - Write RAW input to .stan/patch/.patch (apply still uses the cleaned text in memory).

- Project doc clean‑up: removed obsolete “stan.dist/” reference; clarified RAW patch persistence.

- Attempts integration test: fixed regex escaping to assert attempt lines reliably.
