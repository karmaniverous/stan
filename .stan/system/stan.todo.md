# STAN Development Plan (tracked in .stan/system/stan.todo.md)

When updated: 2025-09-23 (UTC)

Completed (recent)

- feat(run/options): remove -b/--bell across CLI, behavior, types, and docs
  - Deleted bell options and all related code paths; removed run.ding from
    CliDefaults schema/types/normalize and the ASCII BEL write.
  - Removed obsolete test src/stan/run/ding.test.ts.
  - Docs: dropped bell references and examples.
  - Minor change; changelog untouched per instruction.

- feat(run/help): add -l/--live and -L/--no-live; reorder and retag defaults
  - Live now has short forms (-l/-L); pairs are adjacent with the positive
    short option first; short-form options precede long-only options.
  - For booleans, Commander no longer prints “(default: true|false)”. We tag
    the defaulted member of each pair with “(default)”. Numeric thresholds
    keep “(default: N)”.

- feat(run/help): display numeric defaults for hang thresholds and patch default file
  - Run help now appends “(DEFAULT: Ns)” for:    - --hang-warn (120s by default),
    - --hang-kill (300s by default),
    - --hang-kill-grace (10s by default),
    overriding with cliDefaults.run when present.
  - Patch help appends “(DEFAULT: <path>)” to -f/--file when cliDefaults.patch.file is set.
  - Added tests:
    - runner.help.defaults.test.ts ensures defaults appear in run help,
    - patch.help.defaults.test.ts ensures default file path appears in patch help.

- feat(run/defaults): adopt rational built-in hang thresholds and align supervisor grace
  - Built-in defaults (when flags/config absent):
    - hangWarn=120s, hangKill=300s, hangKillGrace=10s.
  - deriveRunParameters applies these defaults to behavior.
  - ProcessSupervisor default grace changed from 8s to 10s for consistency.
  - Added a test in runner.defaults.test.ts to assert built-in threshold behavior.

- docs(typedoc): export BlockKind in validate/response to include the referenced
  type in generated docs and remove the TypeDoc warning.
- fix(run/cancel): race scripts against cancellation; skip archive and return immediately when cancelled
  - Added a cancellation rendezvous in runSelected and a Promise.race around script execution so q/CtrlC stop the run promptly without waiting on long children.
  - Guarded an early return before the archive phase to ensure no archives are written on cancel; addresses failing cancel.\* tests.- feat(run/scripts): treat non‑zero exit code as failure (without suppressing artifacts)
  - Capture each script’s exit code and mark the live row as error when exit ≠ 0.
  - Set process.exitCode = 1 when any selected script fails so CI and shells can detect failure.
  - Preserve behavior of writing outputs and archives so chat context remains complete.
  - LoggerUI appends “(exit N)” to the “done” line when a script exits non‑zero.

- chore(clean): remove dead type stubs and unused utility
  - Deleted src/types/keypress.d.ts and src/types/istextorbinary.d.ts (no longer referenced).
  - Removed unused fileNameOf() export from src/stan/util/time.ts.- refactor(cli/run): inline selection helper and drop extra file
  - Inlined deriveRunInvocation into src/cli/stan/run/derive.ts; removed src/cli/stan/run-args.ts.
- refactor(snap): drop handlers re‑export; import concrete modules directly
  - Updated CLI (snap) to import from '@/stan/snap/history' and '@/stan/snap/snap-run'.
  - Adjusted snap.defaults.test.ts mocks accordingly.
- chore(snap): remove no‑op ensureDirs([]) guard in snap‑run.ts and its unused import.

- feat(live/summary): represent all statuses and update emojis
  - Waiting emoji switched to ⏳; Timeout emoji switched to ⌛.
  - Summary now includes counts for running, quiet, and stalled; all statuses are represented. - Quiet remains yellow; stalled is now orange to distinguish it from quiet.
  - Ordering near the end of the summary is now: quiet | stalled | timeout.
  - Implementation details:
    - Added orange() helper in util/color; live renderer summary and row labels updated accordingly.

- fix(live/cancelled‑time): show blank Time for never‑started rows
  - Previously, cancelling while a row was still “waiting” rendered “00:00” in the Time column, which implied the step ran for 0 seconds. We now omit duration for never‑started rows so the Time column is blank.
  - Affects both script rows and archive rows that never actually started.
- fix(cancel/exit‑latency): exit immediately on user cancel (q/Ctrl+C)
  - Move the hard exit into the cancellation pipeline after stopping the UI and signalling children with immediate TERM→KILL escalation.
  - Result: control returns to the shell right away.
- fix(run/live): pre-register all planned steps as “waiting” at run start
  - Scripts: enqueue all selected keys so the live table shows them immediately.
  - Archives: enqueue “full” and “diff” rows whenever archives are enabled. - LoggerUI remains a no-op for queueing; presentation parity retained.
  - Result: sequential and concurrent modes differ only in execution order; scheduling/presentation is identical.

- test(setup): pause stdin and add a brief delay in global afterEach to mitigate transient EBUSY/ENOTEMPTY on Windows when removing temp dirs.

- tests(module): add unit coverage for getPackagedSystemPromptPath() resolving both null/exists branches.
- tests(assemble): add unit for assembleSystemMonolith() “skipped-no-md” behavior when parts contain no .md files.

- refactor(gen-system): reuse centralized config discovery/stanPath resolution from src/stan/config (findConfigPathSync + loadConfig) instead of a local resolver in gen-system.ts to avoid drift.

- refactor(cli): centralize (DEFAULT) help tag helper in cli-utils and adopt in index/run.options/snap (removed duplicate local helpers).- refactor(archive): share tar exclusion filter and archive warnings logger; adopt in archive.ts and diff.ts for consistent behavior.
- refactor(fs): introduce ensureStanWorkspace() and refactor ensureOutAndDiff/ensureOutputDir to prevent drift in workspace directory creation.
- feat(run/input): add sigintOnly option to installCancelKeys to allow SIGINT‑only wiring (no raw mode/keypress) for no‑live/CI; LoggerUI now uses the unified handler (SIGINT only).
- refactor(system): extract parts→monolith assembler to src/stan/system/assemble.ts; adopt in dev script (gen-system.ts) and runtime archive path for the dev repo.
- refactor(module): add getModuleRoot()/getPackagedSystemPromptPath(); adopt in archive/version/init/docs for a single source of module/dist discovery.
- refactor(run/exec): Remove direct console logging; engine is now fully “silent” and reports lifecycle only via hooks. LoggerUI/LiveUI remain the only presentation layers.
- feat(run/ui Logger): Add SIGINT parity in no‑live mode. LoggerUI now installs a SIGINT handler to trigger the same single cancellation pipeline used by LiveUI, ensuring consistent behavior across modes.
- test(run): UI parity — run the same selection with live and no‑live; assert identical outputs and archive decisions.
- test(run): Cancel parity — in no‑live mode, emit SIGINT during execution (sequential); assert no archives, non‑zero exit, completed scripts remain OK, and scheduling stops before the next item.

Next up

- Consider migrating gen-system.ts configuration discovery to reuse src/stan/config/discover/load to avoid any future drift (currently kept self‑contained).
- Add small unit around getPackagedSystemPromptPath() and assembleSystemMonolith() if gaps are observed (current integration tests cover behavior indirectly).
- Keep monitoring recent test timeouts on Windows EBUSY/ENOTEMPTY; schedule follow-up stabilization if they persist after unrelated changes.

---- refactor(run/ui): Introduce RunnerUI with two adapters:

- LoggerUI (no‑live): prints legacy “stan: start/done …” lines for scripts and archives; plan remains printed. - LiveUI (live): owns ProgressRenderer and key handling; archive/script progress forwarded only through the UI. - Engine (runSelected/runScripts/runOne/archivePhase) now always runs “silent” and reports lifecycle into the UI; live/no‑live is a pure UI swap.
- Cancellation pipeline calls ui.onCancelled() to finalize live frame and restore listeners; ProcessSupervisor.cancelAll({ immediate: true }) unchanged.
- Outcome: no behavior change for artifacts; UI cannot influence process control or I/O anymore.

---

- feat(live/summary): Add a dedicated CANCELLED count to the live summary using the same ◼ symbol shown in the table. Cancellations are no longer included in the FAIL count.
  - TTY summary: “… • ⏱ <waiting> • ✔ <ok> • ◼ <cancelled> • ✖ <fail> • ⏱ <timeout>”
  - BORING summary: “… • waiting N • OK N • CANCELLED N • FAIL N • TIMEOUT N” - Status row rendering remains unchanged.
- fix(cancel/exit): Ensure `stan run` exits promptly after user cancellation (q/Q/Ctrl+C) in CLI runs by explicitly calling `process.exit(1)` once children are signaled and the live renderer has been stopped (skipped under tests). This returns control to the shell and prevents further script output after cancel.

- fix(cancel/live): Preserve finished rows and keep their final values on cancel; finalize durations for in‑flight rows at the moment of cancellation; do not clobber output paths that have already been written. - Renderer: add cancelPending() to mark only waiting/running/quiet/stalled rows as cancelled; compute duration from startedAt; leave done/error/timedout/killed rows untouched so their status/time/path remain visible.
  - Service: on cancel, call renderer.cancelPending() and keep the cancelledKeys suppression so late onEnd events do not flip cancelled rows to done.
  - Outcome: • Concurrent mode: program exits promptly; outputs stop once children are killed. • Sequential mode: completed scripts remain OK; only pending/in‑flight show cancelled. • Time and Output columns retain final values where applicable.

- fix(cancel): On user‑initiated cancellation (q/Q/Ctrl+C), ignore hangKillGrace and escalate SIGTERM → SIGKILL immediately; also flush+stop the live renderer and restore key listeners right away. This prevents continued script output after cancel and allows the process to exit promptly. hangKillGrace remains in effect for hang/timeout scenarios; it simply does not delay user cancel.

- refactor(run/input): use Node’s readline.emitKeypressEvents for TTY key handling; drop external 'keypress' dependency and its type stub; keep SIGINT parity and 'data' fallback; update Rollup externals and package.json.
  - Rationale: reduce legacy CJS surface and simplify runtime/bundling.
  - Impact: no behavior changes; q/Ctrl+C cancellation remains idempotent; tests remain green.

- chore(build): remove 'keypress' from Rollup externals; delete src/types/keypress.d.ts.
- fix(live/cancel): add 'data' fallback to TTY key handler so pressing 'q' cancels reliably in test environments without raw mode; cancel.key test now passes.
- fix(lint): remove unused variable in src/stan/run/input/keys.ts to satisfy @typescript-eslint/no-unused-vars.

---

<!-- validator moved to Completed (initial library). Integration into composition remains a separate track and will be planned when the composition layer is introduced in-repo. -->

Completed (recent)

- fix(build): externalize 'keypress' in Rollup to avoid strict‑mode parse error ("Legacy octal escape") when bundling; runtime resolves the CJS module.
- fix(types): broaden TTY key handler to (...args: unknown[]) and destructure to satisfy strict function type checks in typedoc/typecheck.
- fix(typecheck): harden run/service shutdown cleanup with a callable guard before invoking restore; eliminates persistent TS2349 (“never not callable”) seen under typedoc/typecheck.
- note(refactor prep): keypress-based TTY handling and live/decomposition to follow in a dedicated change set (smaller steps, easier review).
  - Tests: all green after fallback (cancel.key) and lint clean.

- Init snapshot prompt behavior- On "stan init": - If no snapshot exists at <stanPath>/diff/.archive.snapshot.json, do not prompt about snapshots. - If a snapshot DOES exist, prompt: “Keep existing snapshot?” (default Yes). If answered “No”, replace/reset the snapshot. - Interactive only; in --force mode, keep existing snapshot by default (future override flag TBD).
  - CLI copy example: Keep existing snapshot? (Y/n)
- TTY live run status table, hang detection, and graceful cancellation
  - (done) Two‑space alignment for table, summary, and hint (matches run plan).
  - (done) TTY key handler (q/Q) + SIGINT parity; idempotent cancellation with TERM→grace→KILL via tree‑kill; stop scheduling; skip archive; non‑zero exit; always restore TTY state/listeners. Tests added.
  - (done) Added test to verify scheduler stops launching new scripts after cancellation.

- Long‑file monitoring and decomposition (Phase 3)- Continue to monitor near‑threshold modules; propose splits if any trend toward or exceed ~300 LOC in future changes.
- Coverage follow‑ups - Ensure tests remain strong for src/stan/config/{discover/load/normalize/output}; consider small additional cases for load.ts branches as needed. - Target incremental gains over ~86% lines coverage as changes land.
  - Keep excludes limited to trivial barrels and types‑only modules.

Completed (recent)

- fix(build): resolve all type and reference errors in `run/service`. A reference error (`k is not defined`) in the renderer callbacks was fixed. The persistent `TS2349` error was resolved by refactoring the `restoreTty` cleanup logic to a pattern that TypeScript's control-flow analysis can reliably validate.
  - Typecheck/build/docs/tests: green.

- fix(build): add `rimraf .rollup.cache .tsbuildinfo` to the `build` script to prevent stale cache from causing erroneous typechecking failures.
  - Build: now reliably clean.

- fix(build): resolve TS2349 in `run/service` by hardening the `restoreTty` callable guard to `typeof rt === 'function'`. This prevents TypeScript's control-flow analysis from narrowing the type to `never` within the `try...finally` block, ensuring the build, typecheck, and docs scripts pass.
  - Typecheck/build/docs: green.- chore(lint): add ESLint ignore for transient `rollup.config-*.mjs` files. This prevents intermittent `eslint --fix` runs from failing with an `ENOENT` error when trying to open an ephemeral file.
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

- docs: cli/config updates documenting built-in hang threshold defaults.

- fix(run/service): import ProcessSupervisor as a value (not type); remove unused ScriptState import; replace optional-call on restoreTty with explicit callable guard; remove unused local time var.
  - Lint: resolves no-unused-vars.
  - Typecheck/docs/build: green.
- feat(live/glyphs): unify TTY waiting/timeout glyph to single‑width ⏱ in both per‑row status and the summary; BORING remains [WAIT]/[TIMEOUT] text tokens.
  - Keeps single‑line summary with bullet separators; no changes to BORING labels beyond the existing textual tokens.

- fix(tests): keep type checking in tests; adjust cancel.key test to avoid stubbing setRawMode with a mismatched signature. The handler tolerates missing setRawMode.
  - Ensures “Do NOT disable type checking in tests.”
- feat(live/cancel): TTY key handler (q/Q) and SIGINT parity
  - Install raw key handler in TTY live mode; pressing q/Q or Ctrl+C triggers a single cancellation pipeline.
  - Pipeline: stop scheduling new scripts, send SIGTERM to all tracked children; after grace, send SIGKILL via tree-kill; mark rows cancelled; skip archive if cancelled before archive; set process.exitCode=1; restore TTY state and listeners in all cases. - Add ProcessSupervisor.cancelAll with TERM→KILL escalation and tree-kill wiring (clears knip unused‑dep warning).
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
