# STAN Development Plan (tracked in .stan/system/stan.todo.md)

When updated: 2025-09-23 (UTC) — Fix TS2349 in run/service shutdown guard; prepare for TTY refactor.

<!-- validator moved to Completed (initial library). Integration into composition remains a separate track and will be planned when the composition layer is introduced in-repo. -->

Completed (recent)

- fix(typecheck): harden run/service shutdown cleanup with a callable guard before invoking restore; eliminates persistent TS2349 (“never not callable”) seen under typedoc/typecheck.
- note(refactor prep): keypress-based TTY handling and live/decomposition to follow in a dedicated change set (smaller steps, easier review).

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
