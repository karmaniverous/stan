# STAN Development Plan

When updated: 2025-09-28 (UTC)

Next up (priority order)

- Zod schema – friendly errors & suggestions (phase 2)
  - Extend scripts map to accept either a string or `{ script, warnPattern }`.
  - On exit code 0: test combined output against `warnPattern`; emit status=warn on match.
  - Update run/exec pipeline to surface “warn” alongside ok/error.
  - Tests:
    - ok → warn transition when pattern matches output.
    - ok remains ok when no pattern or no match.
    - error remains error (exit code ≠ 0) regardless of pattern.

- UI palette and labels: magenta → orange; add WARN
  - util/color.ts: add `orange()` via `chalk.hex('#FFA500')`.
  - Replace magenta usages with orange (e.g., “stalled”).
  - Add status “warn”:
    - Live: orange “⚠ warn”; Logger: “[WARN]”.
  - Update summary line counts to include “warn” if surfaced separately (or fold into OK if we keep totals compact).
  - Tests: verify boring tokens and live table rows reflect WARN with orange replaced everywhere magenta was used.

- Config validation: zod schema (schema‑first) + friendly errors
  - Define top‑level zod schema; infer `ContextConfig` types. (initial landing done)
  - Phase 2 (follow‑up in this slice):
    - Unknown keys: include closest‑match suggestions in error output.
    - Improve pathing in error messages for nested keys.
    - Expand coercions (where useful) and normalize without duplicate utilities.
    - Update docs to note schema‑first validation and WARN semantics.
  - Keep tests green; extend coverage for error text and suggestions.
  - Validate scripts union (string | object with warnPattern).
  - Disallow unknown keys with friendly messages and suggestions.
  - Tests: unknown key error wording; invalid warnPattern; happy‑path coercions as needed.

- Class‑based design adoption audit
  - Apply the new project policy: prefer class‑based design wherever possible.
  - For touched modules, prefer introducing small single‑responsibility classes that fit existing ports/adapters seams.
  - Do not refactor purely for style; convert opportunistically with functional changes, and record any follow‑ups as needed.

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

- Color alias propagation (fix CI/type errors; unify UI):
  - Replaced legacy color imports/usages with semantic helpers:
    - open.ts: yellow/cyan/red -> alert/error
    - run/labels.ts: gray/blue/green/red/cyan/magenta/black -> cancel/go/ok/error/alert/warn/stop
    - run/live/renderer.ts: gray -> dim for neutral hint/idle text
  - Resolved missing exports at build/docs/typecheck and eliminated runtime “gray/cyan/... is not a function” errors in tests.
- Patch failure wording alignment (system prompt)
  - Replaced legacy “FEEDBACK” references with “patch failure diagnostics envelope” and updated links to “Patch failure prompts.”
  - Adjusted the Table of Contents, Commit Message exception, Fence Hygiene note, and Response Format bullets to point at the canonical prompts and terminology.

- Color helpers — semantic aliases + orange warn
  - util/color.ts: renamed helpers to meaning-based names:
    - ok (green), alert (cyan), warn (orange), error (red), go (blue), stop (black), cancel (grey).
  - Replaced magenta usages with warn (orange) for “stalled”.
  - Updated call sites (labels, summary, preflight, archive logs, status).
  - BORING/non‑TTY behavior unchanged (unstyled).

- System prompt — introduce stan.requirements.md separation
  - Added `stan.requirements.md` to CRITICAL Layout and Documentation conventions as the STAN‑maintained end‑state requirements document.
  - Clarified that developers may edit it directly but shouldn’t have to; STAN will create/update it on demand (no change to `stan init` behavior).
  - Added an always‑on separation guard to move content when requirements drift into the project prompt (or vice versa).

- jsdiff fallback — create parent directories for new files
  - Ensure parent directory exists on non‑check writes when applying a “/dev/null” new‑file patch to a nested path (e.g., src/rrstack/describe/lexicon.ts).
  - Makes `stan patch` robust when git apply warns about trailing whitespace and falls back to jsdiff: new files in nested folders are now created reliably.
  - Added nested new‑file test to cover this scenario.

- Patch fallback + diagnostics (downstream)
  - jsdiff fallback now supports creating new files when the patch uses “--- /dev/null” → “+++ b/<path>”. This unblocks new‑file patches when `git apply` cannot be used.
  - Downstream diagnostics now include attempt summaries and jsdiff reasons, eliminating blank envelopes (“START/END” with no content).

- Sequential cancellation gate (tests)
  - Added a one‑tick event‑loop yield after each sequential script completes and re‑checked the cancellation gate before scheduling the next script.
  - Closes a race where SIGINT arriving immediately after a runner finished could allow the next script to start (fixes cancel.gate and cancel.schedule).

- Live BORING labels — bracket tokens
  - Unify Live’s BORING tokens to bracketed form ([OK]/[FAIL]/…) using the shared label helper.
  - Fixes the final‑frame expectation in live.order.flush.test without changing non‑TTY/TTY behavior.
  - Follow‑up: finish DRY by switching Logger to the same helper and removing its local duplicate.

- Unified patch failure feedback (downstream == STAN)
  - Formatter now emits the STAN diagnostics envelope (attempt summaries + jsdiff reasons) for both downstream and STAN repos for Diff and File Ops failures.
  - System prompt updated to reflect the unified behavior and to direct assistant follow‑up with analysis and options.

- Assistant follow‑up options (all repos)
  - Added explicit options language to the system prompt: “1) New patch[es] (recommended)… 2) Full listings…”.

- STAN‑repo gating phrase (apply/defer)
  - Project prompt updated to include explicit gating: “Say ‘apply’ to make [prompt | code] changes now or ‘defer’ to save them to the dev plan.”

- Reserved workspace exclusions (single source)
  - Extended the reserved helpers into filterFiles() so selection and tar filters share one definition (diff/patch always excluded, output excluded unless combine).

- Test teardown helpers — retry window extended
  - Increased rmDirWithRetries default backoff with a 3200 ms step to further mitigate transient Windows EBUSY on CI.

- Logger status labels — DRY via shared helper
  - Switched the Logger UI to use the shared status‑label helper and removed its local duplicate.
  - Maintains parity with Live; BORING tokens remain bracketed and stable; TTY colored symbols preserved where applicable.

- Test updates — unified diagnostics envelope (downstream == STAN)
  - Updated tests that asserted legacy downstream one‑liners to assert the unified diagnostics envelope:
    - src/stan/patch/format.test.ts (diff + file‑ops cases)
    - src/stan/patch/service.format.behavior.test.ts (integration)
  - README docs sweep: replaced “FEEDBACK envelope” wording with “diagnostics envelope” and adjusted guide label text.
  - Keeps the repo aligned with the completed formatter behavior change.

- Windows cancel teardown — additional EBUSY hardening
  - Increased final post‑cancel settle on Windows to 1600 ms (non‑Windows 400 ms) to further reduce transient EBUSY during test directory removal.

- Windows cancel teardown — EBUSY hardening
  - Extended default backoff in rmDirWithRetries to [50, 100, 200, 400, 800, 1600] ms to better tolerate transient rmdir EBUSY on Windows CI.
  - Updated cancel.schedule.test.ts to use rmDirWithRetries in afterEach (was direct rm).
  - Goal: reduce remaining cancellation‑path flakes without increasing session settle time.

- Project policy — class‑based design directive
  - Added a project‑level directive to prefer a class‑based design wherever possible.
  - Guidance: single‑responsibility classes, ports/adapters alignment, compositional preference, opportunistic migration, and paired tests.

Completed (this change set)

- Schema‑first config (initial)
  - Introduced strict zod schema for stan.config.* (scripts union; warnPattern validation; basic coercions).
  - wired loadConfig/loadConfigSync through the schema; normalized imports; defaulted patchOpenCommand.
  - Friendly error aggregation for regex validation (path + message).
- WARN runtime status
  - exec/run: evaluate warnPattern on exit=0 against combined output; status='warn' when matched.
  - UI: added WARN across Logger and Live; distinct WARN counter in summary; labels: orange “⚠ warn” (TTY) / “[WARN]” (boring).
  - Progress model/states extended with 'warn'.
  - Tests: schema union + invalid warnPattern; logger shows [WARN] on match.