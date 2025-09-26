# STAN Development Plan

When updated: 2025-09-26 (UTC)

Next up (priority order)

1. Cancel pipeline — fix SIGINT parity test
   - Reproduce and fix the failing case in src/stan/run/cancel.sigint.test.ts.
   - Ensure archives are always skipped on cancellation (no archive.tar | archive.diff.tar) even when SIGINT arrives during the short race after scripts start.
   - Keep bounded settle/join behavior; prefer short, deterministic waits.

2. Windows stabilization
   - Verify rmDirWithRetries usage across cancel tests; keep a short final settle.
   - Keep ProcessSupervisor.waitAll with a short deadline in tests.

3. Minor follow-ups — optional subcommand harness to DRY Commander glue after cancellation fixes.

- DMP readiness (follow-on)
  - When DMP apply lands, feed its stderr/summary through the same formatter and share the envelopes with diff/file ops behavior.
  -
- Codebase reduction: identify and eliminate dead or duplicated code where safe; prefer reuse of shared helpers.

- Adopt explicit dev‑mode diagnostics triage in project prompt: analyze → ask → apply or listings; gate patch emission on explicit approval.

Unpersisted tasks

- Extend formatter to incorporate future DMP rung (produce a DMP attempt line + reasons alongside git/jsdiff).
- Minor polish:
  - Audit other diagnostics call-sites for reuse of the shared helpers.
  - Consider a brief docs note in README about full vs diff archive contents (patch workspace policy).

Completed (recent)

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
