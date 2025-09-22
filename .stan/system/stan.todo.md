# STAN Development Plan (tracked in .stan/system/stan.todo.md)

When updated: 2025-09-22 (UTC) — Live TTY: add deps, flags, and scaffolding; preserve non‑TTY behavior. Resolve ESLint 9 peer conflict; fix live defaults typings/tests.

<!-- validator moved to Completed (initial library). Integration into composition remains a separate track and will be planned when the composition layer is introduced in-repo. -->
- Init snapshot prompt behavior
  - On "stan init":
    - If no snapshot exists at <stanPath>/diff/.archive.snapshot.json, do not prompt about snapshots.
    - If a snapshot DOES exist, prompt: “Keep existing snapshot?” (default Yes). If answered “No”, replace/reset the snapshot.
  - Interactive only; in --force mode, keep existing snapshot by default (future override flag TBD).
  - CLI copy example: Keep existing snapshot? (Y/n)

- TTY live run status table, hang detection, and graceful cancellation
  - Live table (TTY only; controlled by --live/--no-live, default true; supports cliDefaults.run.live)
    - Deps: log-update (in-place refresh), table (column layout), tree-kill (cross‑platform process tree termination)
    - Columns: Script | Status | Time | Output (show output path only when done/error/cancelled/timed out)
    - Status states:
      - waiting, running…
      - running (quiet: Xs) — no output yet past quietWarn
      - running (stalled: Xs) — previously produced output then silent past hangWarn
      - done, error, timed out, cancelled/killed
    - Boring mode: drop emojis and colors, keep text; live UI still enabled unless --no-live or non‑TTY
    - Non‑TTY: keep current line-per-event logs; no live table
  - Hang detection (per script; concurrency‑safe)
    - Track startAt and lastOutputAt; compute elapsed and quietFor
    - Thresholds (configurable; defaults): quietWarn=60s (label only), hangWarn=120s (label only), hangKill=disabled, hangKillGrace=8s
    - Only auto‑terminate on explicit wall‑clock timeout (hangKill): SIGTERM → grace → SIGKILL (tree‑kill)
  - Manual termination (TTY + live): press q to cancel run gracefully
    - Stop starting new scripts; SIGTERM all running; after grace, SIGKILL stragglers; mark cancelled/killed
    - Skip archiving if cancelled before scripts complete; exit non‑zero; print concise summary
    - Show “Press q to cancel” hint in the live UI
  - CLI flags and defaults (with cliDefaults.run support) — IMPLEMENTED
    - --live / --no-live (default true) — IMPLEMENTED
    - --hang-warn <seconds> — IMPLEMENTED
    - --hang-kill <seconds> — IMPLEMENTED
    - --hang-kill-grace <seconds> — IMPLEMENTED
  - Implementation outline
    - ProgressRenderer: 1s tick; renders table via log-update + table
    - ProcessSupervisor: track child PIDs; soft→hard kill; per‑script timers
    - TTY key handler (raw mode) for q; always restore terminal state on exit

- Long‑file monitoring and decomposition (Phase 3)- Continue to monitor near‑threshold modules; propose splits if any trend toward or exceed ~300 LOC in future changes.

- Coverage follow‑ups - Ensure tests remain strong for src/stan/config/{discover/load/normalize/output}; consider small additional cases for load.ts branches as needed.
  - Target incremental gains over ~86% lines coverage as changes land.
  - Keep excludes limited to trivial barrels and types‑only modules.

Completed (recent)

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
  - Flags: --live/--no-live (default true), --hang-warn, --hang-kill, --hang-kill-grace.  - cliDefaults.run support for live/hang thresholds; docs updated.
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
