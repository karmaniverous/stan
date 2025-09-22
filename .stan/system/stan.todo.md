# STAN Development Plan (tracked in .stan/system/stan.todo.md)

When updated: 2025-09-23 (UTC) — Typecheck/build errors resolved; lint ignores added for transient Rollup configs.

<!-- validator moved to Completed (initial library). Integration into composition remains a separate track and will be planned when the composition layer is introduced in-repo. -->
- Init snapshot prompt behavior- On "stan init": - If no snapshot exists at <stanPath>/diff/.archive.snapshot.json, do not prompt about snapshots. - If a snapshot DOES exist, prompt: “Keep existing snapshot?” (default Yes). If answered “No”, replace/reset the snapshot. - Interactive only; in --force mode, keep existing snapshot by default (future override flag TBD).
  - CLI copy example: Keep existing snapshot? (Y/n)

- TTY live run status table, hang detection, and graceful cancellation
  - (done) Two‑space alignment for table, summary, and hint (matches run plan).
  - (done) TTY key handler (q/Q) + SIGINT parity; idempotent cancellation with TERM→grace→KILL via tree‑kill; stop scheduling; skip archive; non‑zero exit; always restore TTY state/listeners. Tests added.

- Long‑file monitoring and decomposition (Phase 3)- Continue to monitor near‑threshold modules; propose splits if any trend toward or exceed ~300 LOC in future changes.

- Coverage follow‑ups - Ensure tests remain strong for src/stan/config/{discover/load/normalize/output}; consider small additional cases for load.ts branches as needed. - Target incremental gains over ~86% lines coverage as changes land.
  - Keep excludes limited to trivial barrels and types‑only modules.

Completed (recent)

- fix(build): resolve TS2349 in `run/service` by hardening the `restoreTty` callable guard to `typeof rt === 'function'`. This prevents TypeScript's control-flow analysis from narrowing the type to `never` within the `try...finally` block, ensuring the build, typecheck, and docs scripts pass.
  - Typecheck/build/docs: green.

- chore(lint): add ESLint ignore for transient `rollup.config-*.mjs` files. This prevents intermittent `eslint --fix` runs from failing with an `ENOENT` error when trying to open an ephemeral file.
  - Lint: runs cleanly without chasing transient configs.

- fix(live/align): strip the single leading pad emitted by table() before adding the exact two‑space indent for table, summary, and hint. Ensures header/body left edge aligns with the run plan block in both BORING and TTY modes.
  - Tests: live.align passes header/summary/hint two‑space checks.
- fix(run/service): resolve TS2349 on restoreTty by guarding via a local const typeof function check (avoids the TS transformer narrowing to never). Also ensure stdin.pause() is invoked in the restore handler so the event loop can exit cleanly (prevents Windows EBUSY on temp dir removal in sequential mode tests).
  - Typecheck/build/docs: green under rollup and typedoc.
  - Exit behavior: no lingering TTY/raw state; listeners removed; event loop allowed to drain.

- fix(live/summary): in BORING mode, remove brackets around the elapsed time so the summary line matches the expected “mm:ss • …” pattern with exactly a two‑space indent. TTY summary remains emoji‑styled; BORING uses plain labels with the same bullet separators. No change to counts or glyph policy (⏱ for waiting/timeout in TTY; [WAIT]/[TIMEOUT] labels in BORING remain).
- fix(live/align): strip single leading pad emitted by table() before adding exactly two-space indent so header/body/summary/hint align with plan block.
  - Tests: live.align now matches exactly two spaces on header/summary/hint.
- fix(live/exports): remove duplicate/conflicting export in src/stan/run/live.ts that broke typecheck/build/docs.

- fix(run/service): import ProcessSupervisor as a value (not type); remove unused ScriptState import; replace optional-call on restoreTty with explicit callable guard; remove unused local time var.
  - Lint: resolves no-unused-vars.
  - Typecheck/docs/build: green.

- feat(live/glyphs): unify TTY waiting/timeout glyph to single‑width ⏱ in both per‑row status and the summary; BORING remains [WAIT]/[TIMEOUT] text tokens.
  - Keeps single‑line summary with bullet separators; no changes to BORING labels beyond the existing textual tokens.

- fix(tests): keep type checking in tests; adjust cancel.key test to avoid stubbing setRawMode with a mismatched signature. The handler tolerates missing setRawMode.
  - Ensures “Do NOT disable type checking in tests.”
- feat(live/cancel): TTY key handler (q/Q) and SIGINT parity
  - Install raw key handler in TTY live mode; pressing q/Q or Ctrl+C triggers a single cancellation pipeline.
  - Pipeline: stop scheduling new scripts, send SIGTERM to all tracked children; after grace, send SIGKILL via tree‑kill; mark rows cancelled; skip archive if cancelled before archive; set process.exitCode=1; restore TTY state and listeners in all cases. - Add ProcessSupervisor.cancelAll with TERM→KILL escalation and tree‑kill wiring (clears knip unused‑dep warning).
  - Tests:
    - cancel.sigint.test.ts: emit SIGINT; verify no archives created; exit code non‑zero.
    - cancel.key.test.ts: simulate 'q' keypress; verify no archives created; exit code non‑zero.

- feat(live): two‑space alignment for live renderer output (table, summary, hint); new test asserts two‑space indent under BORING TTY.

- feat(live): scripts-first ordering, final-frame flush, and aligned waiting glyph
  - ProgressRenderer:
    - Group rows so scripts render first and archives last (stable order within each group).
    - Add flush() to render a final frame (stop() remains persist-only).
    - Replace the double-width waiting emoji with a single-width glyph (“… wait”) to eliminate column drift.
  - Service: call renderer.flush() before renderer.stop() so the last frame reliably shows archive:diff as OK with its Output path.
  - Tests: add TTY‑guarded test to assert:
    - scripts appear above archives in the live table, and
    - final frame includes archive:diff in OK state (flush).
  - Non‑TTY behavior unchanged (legacy per‑event logs).

- feat(live): align table left edge with run plan; bold column headers
  - Rendering:
    - Prefix one extra leading space to each rendered line (table, summary, hint) so the table’s left edge aligns with the run plan body.
    - Bold the column headers (Type, Item, Status, Time, Output) in TTY mode; BORING mode remains plain (no styling).
  - Notes:
    - Alignment is purely presentational; no content changes to row data.
    - BORING output is unchanged except for the added one‑space indent to match plan alignment.

- fix(tests): stabilize live.order.flush test
  - Ensure regex scanning uses a global pattern when calling String.prototype.matchAll to avoid runtime error.
  - Mirror the stdout write spy typing approach used in ding.test.ts to satisfy typecheck/docs builds.
  - No behavior changes to runtime; tests/doc builds return to green.

- fix(run/archive): remove erroneous overload/stub; single typed function with optional opts param
  - Resolve TS/parse errors (redeclaration, '=>' expected).
  - service: type progress callback params (kind/pathAbs/startedAt/endedAt) to satisfy TS/ESLint. - Keep silent logging and live progress wiring unchanged.

- feat(live/archive): pre-register archive rows and update via archivePhase hooks
  - service: when live is enabled and archive=true, register `archive:full` and `archive:diff` rows as waiting.
  - archivePhase: added optional progress callbacks (start/done) and a `silent` flag to suppress legacy console logs. - service: wire progress to live rows (running/done with relative output paths), pass `silent=true` to suppress console logs during live.
  - Non‑TTY behavior unchanged; existing tests remain stable.

- feat(live): color summary counts (TTY)
  - Summary line now colors both the emoji and the numeric counts using yellow/green/red (BORING remains plain labels).
  - Keeps a single summary line under the table and the “Press q to cancel” hint.

- test(live): TTY-guarded suppression of legacy archive logs when live is on
  - New test ensures `stan: start/done "archive"` and `"archive (diff)"` lines are not printed during live runs.

- feat(live): renderer metadata/columns + summary; stop() persist-only; spacing
  - ProgressRenderer now tracks row identity with stable keys and metadata:
    - keys: `script:<name>`, `archive:full`, `archive:diff` - columns: [Type, Item, Status, Time, Output]
  - Adds a compact live summary line below the table:
    - “[elapsed] • [waiting] N • [ok] N • [error] N • [timeout] N” (BORING uses plain labels)
  - Prints “Press q to cancel” hint under the summary (before key handler wiring).
  - stop(): no final render; call logUpdate.done() to persist last frame (prevents doubled header/“weird on scroll”).
  - service: print exactly one blank line between run plan and the first live frame.

- fix(lint): remove unused Writable import from src/stan/run/exec.ts

- fix(live): suppress per-script “start/done” logs when TTY live table is active
  - Add silent flag through runScripts → runOne; enable only when renderer is on.
  - Keeps non‑TTY (tests/CI) unchanged (line‑per‑event logs remain).- fix(live): remove duplicate time in table and blank row separators
  - Status column no longer includes elapsed; Time column is the single source.
  - Disable horizontal separators (previously rendered as blank lines).
  - Keep BORING styling; retain Output column only for terminal states.

- fix(live): resolve TS/ESLint issues in live renderer
  - Replace ts-expect-error + short-circuit with type-safe optional call to logUpdate.done() to clear TS2578 and no-unused-expressions. - Remove an unused local variable in statusLabel() to satisfy ESLint.
  - No runtime behavior change; live table remains visible in TTY; non‑TTY unchanged.

- fix(eslint): replace deprecated eslint-plugin-vitest with @vitest/eslint-plugin
  - Resolves npm ERESOLVE peer conflict caused by eslint-plugin-vitest pinning ESLint ^8.
  - Adds @vitest/eslint-plugin (compatible with ESLint 9) and updates eslint.config.js import.
- fix(typedoc/derive): extend run defaults typing for live/hang thresholds
  - Add live, hangWarn, hangKill, hangKillGrace to local typing in derive/options to satisfy TS checks under Typedoc.
  - No runtime behavior change; aligns with CliDefaultsRun in src/stan/config/types.ts.

- fix(tests): complete runner.live.defaults.test.ts
  - Add missing closing braces and assert hang thresholds parsing from CLI flags.
  - Unblocks build/docs/tests.

- note: lints
  - Remaining scaffolding in live/service preserved; integration wiring will address any residual lint notes when live UI is implemented.

- feat(run): add live-mode flags and defaults; scaffold TTY live infrastructure
  - New runtime deps: log-update, table, tree-kill (no change to non‑TTY runs).
  - Flags: --live/--no-live (default true), --hang-warn, --hang-kill, --hang-kill-grace. - cliDefaults.run support for live/hang thresholds; docs updated.
  - Behavior unchanged for now; ProgressRenderer/ProcessSupervisor scaffolds added and idle until wired.
  - Added focused tests for defaults/overrides parsing.

- chore(tsdoc): escape “>” in src/stan/diff.ts TSDoc
  - Fix tsdoc/syntax warning by escaping “>” in angle-bracket tokens.
  - No behavior changes.

- fix(diff): include patch dir in diff archives only for STAN dev repo
  - Compute inclusion via getVersionInfo(cwd).isDevModuleRepo.
  - Remove undefined includePatchDirInDiff usage and resolve TS2552 errors in src/stan/diff.ts. - Update snap selection-sync test to expect only the sentinel (no forced patch dir) for downstream repos.
  - Rationale: including .stan/patch in diff archives is only necessary when developing STAN itself; downstream consumers should not ship patch workspace by default.

– docs(system): refine handoff format

- Remove “Current state (from last run)” (redundant with stan run outputs).
- Add “Reasoning summary (for context)” section to carry forward decisions/constraints succinctly.
- Add final “Reminders” section instructing next‑thread STAN to validate patch formatting & fence hygiene.
- chore(git): ignore \*.rej and remove stray reject
  - Add '\*.rej' to .gitignore to prevent accidental commits of patch rejects.
  - Remove stray src/cli/stan/runner.ts.rej; future rejects are relocated under .stan/patch/rejects/ by the patch pipeline.
- docs: normalize CLI examples front matter
  - Replace residual patch markers at the top of docs-src/cli-examples.md with proper YAML front matter (title only); keep the rest of the content unchanged.

- fix(test): correct stdout.write spy typing in ding.test.ts
  - Use precise generic form for vi.spyOn on process.stdout.write and a compatible mock implementation.
  - Unblocks rollup/typecheck/typedoc (TS2322 no longer reported from tests during build/docs). - Follow-up: target Writable and mockReturnValue(true) for a TS-safe, minimal spy across environments.
  - Finalize: avoid any by casting stdout to a minimal structural type via unknown; spy on that and return true. This removes lint warnings and keeps typecheck stable.
  - Note: the ASCII BEL (\x07) is written; whether it produces an audible sound depends on terminal/OS settings. Many modern terminals disable audible bells; the flag remains a minimal, portable notification.- feat(run): rename completion bell flags to -b/--bell and -B/--no-bell
  - CLI only; config default remains cliDefaults.run.ding.
  - Help/docs updated; example uses `stan run -b`. - Note: root `-b/--boring` remains at the root command; Commander scopes `-b` correctly when used after `run` (e.g., `stan run -b` toggles the bell).

- fix(run/options): declare missing `sawNoScriptsFlag` used by conflict checks.

- feat(run): add --ding completion bell with cliDefaults support
  - Long option only to avoid conflict with root -d/--debug.
  - Minimal, portable implementation: ASCII BEL to stdout at end of run.
  - Configurable via cliDefaults.run.ding (boolean).
  - No platform‑specific named sounds (non‑portable across OSes/terminals).

- docs(system): align Quick Reference with Response Format — Full Listings not required by default (on request or FEEDBACK only; skip deletions).
- docs(system): add explicit exceptions to mandatory doc cadence (deletions‑only and plan‑only replies) to match the validator.
- docs(system): add missing TOC sections — Architecture (Services‑first), Testing architecture, System‑level lint policy, and Context window exhaustion (termination rule).- docs(system): deduplicate patch rules — Response Format now references the canonical Patch Policy instead of restating “Plain Unified Diff Policy.” This reduces drift and keeps composition guidance focused on fencing/ordering.

- test(snap): fix selection-sync hoisting error in tar mock; move calls capture and vi.mock to module scope and reset in beforeEach. Resolves “ReferenceError: calls is not defined” and brings the suite back to green.
- fix(snap): pass repo config includes/excludes to snapshot writer. Prevents phantom diffs when nested sub‑packages (default‑excluded) are re‑included via config. Verified against Windows report where services/\*\* appeared in archive.diff.tar despite no content edits.
- fix(cli): friendly handling for excess root arguments — print concise message and help; avoid CommanderError stack dump.- docs(system): FEEDBACK quick‑triage mapping for common git errors (path/strip/context/hunk hygiene). Reinforces existing rule to use `summary.changed` when `summary.failed` equals “(patch)”, and adds concise remedies for frequent failure snippets.

- fix(lint): replace require('node:fs').writeFileSync with a typed import in src/stan/config.load.extra.test.ts to satisfy no-require-imports and no-unsafe-\* rules; no runtime code changes. Tests and coverage remain green.
- tests(coverage): add targeted cases for config loading branches (devMode normalization from strings, patchOpenCommand default fallback, maxUndos normalization from string, invalid config guards for stanPath/scripts); small but meaningful coverage gain in src/stan/config/load.ts without touching runtime code.
  - Confirmed normalization surfaces via public loadConfig API.
  - Keeps excludes limited and focuses on high‑value branch coverage as planned.

- docs/system: ensure Markdown list structure survives Prettier
  - replace Unicode “•” pseudo‑bullets with proper nested list markers in design‑first section,
  - add explicit guidance to use standard Markdown list markers (“-”, “\*”, “1.”),
  - note inserting a blank line before nested lists when needed.

- tooling: centralize Prettier as single source of truth; set proseWrap: never and keep embeddedLanguageFormatting: auto; make ESLint plugin defer to Prettier config (no duplicated rule options).
- system: add Markdown formatting policy — no manual wrapping outside commit messages or code blocks; opportunistically unwrap/reflow when touching affected sections.

- system/docs: remove STAN‑repo special cases from the system prompt; direct all prompt updates to `<stanPath>/system/stan.project.md`; add STAN‑specific diagnostics guidance to the project prompt.
- fix(build): remove duplicate import in src/stan/run/archive.ts that caused TS2300 duplicate identifier errors (path/resolve)
- fix(diff): prevent packaged stan.system.md from appearing in archive.diff.tar for downstream repos by restoring the ephemeral monolith before computing the diff archive.
- docs: add badges, expand contributing guide, and flesh out FAQ
- refactor(system): streamline handoff format and remove legacy base64 warnings
- response‑format: default to patches only on first presentation; Full Listings only on FEEDBACK or explicit request; FEEDBACK replies omit commit message
- system: add “Dependency Bug Report” section with valid‑Markdown template (nested code examples; fence‑hygiene reminder)
- bootloader: remove non‑loader guidance (fixed 10‑backtick note, ellipsis hygiene); keep loader + context‑mismatch guard only
- dependency failures: cross‑link to “Dependency Bug Report”
- tests/docs build: remove unused @ts-expect-error in config.normalize.test; ensure package.json in config.discover.test so discovery ascends correctly
- coverage(config): add unit tests for normalize, discover, and output helpers (this change set)
- selection precedence: config excludes > includes > .gitignore — code/tests/docs updated to reflect precedence
- response‑format validator (initial library + tests) available via @/stan/validate/response
- snap: stash/pop confirmations with isolated success test improve operator feedback

DX / utility ideas (backlog)

- CLI/automation:
  - `stan run --plan --json` and `stan -v --json` for tool integration.
  - `stan patch --check --report` to print an affected‑files/hunks summary.
  - Optional progress timers per phase (scripts/archives) with totals.
  - Archive summary line: file count, excluded binaries, large‑text flagged.

- Patch ergonomics:
  - Adaptive context: automatically widen context margins on git/jsdiff failure (re‑try with more context).
  - Add a small preflight lint that flags aggregated multi‑file diffs before composing the final message.
  - Editor integration: open patched files at first changed line (from hunk); support VS Code, Cursor, WebStorm templates via config tokens.
  - Better rejects UX: on failure, surface the new `<stanPath>/patch/rejects/...` root path explicitly and offer a one‑liner to open it.

- Docs & guidance:
  - FEEDBACK envelope “causes” mapping table in docs (path/strip/EOL/context) with suggested assistant remedies.
  - Quick “what to attach” heuristics in CLI output when archives are missing.
