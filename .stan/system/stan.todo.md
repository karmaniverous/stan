# STAN Development Plan (tracked in .stan/system/stan.todo.md)

When updated: 2025-08-26 (UTC) — Long‑file sweep recorded; dts alias fix; monitoring near‑threshold modules

Next up (high value)

- Patch reliability for Markdown/docs:
  - If git/jsdiff both fail and exactly one contiguous section is changed in a .md file, consider a safe, heading‑anchored section‑replacement fallback
    (anchor on H2/H3 heading, replace through next same‑level heading).
    Validate under --check/sandbox first; preserve whitespace; normalize EOL.
    Ship only if demonstrably safe.

- Docs compellingness (low‑effort wins)
  - Add visuals (animated gif/terminal cast) in README for `stan init`, `stan run`, `stan patch`.
  - Expand “Tutorial — Quickstart (End‑to‑End)” with copy‑paste commands and expected outputs.
  - Case Studies: start with rrstack; invite community submissions.
  - Comparison page: “Why STAN Over Alternatives?” with a simple table.
  - Contributing — Dev Quickstart: local setup, commands, PR flow.
  - FAQ: promote common answers (archives cadence, binary handling, unified diffs, CI).
  - Add badges (npm, docs, license) to README for credibility.
  - Link Roadmap (this file) prominently in README.

Completed (recent)

- Validation run (no code changes)
  - build/test/lint/typecheck/docs all green
  - coverage (lines): ~86.2–86.4% (>=85% target)
  - knip: OK
  - outcome: conflict handling (-c vs -A) confirmed at parse-time; CLI semantics unchanged

- coverage(config): exclude trivial barrels and types-only modules from coverage
  - vitest.config.ts: added excludes for src/\*/index.ts and types-only files
  - rationale: avoid skew from non-executable glue; behavior unchanged

- Long‑file sweep (approximate LOC via bytes/60 heuristic)
  - src/cli/stan/index.ts ≈ 236 LOC
  - src/stan/diff.ts ≈ 235 LOC
  - src/stan/fs.ts ≈ 223 LOC
  - src/stan/version.ts ≈ 225 LOC
  - src/stan/run/archive.ts ≈ 190 LOC
    Decision:
  - All reviewed files are under the ~300 LOC guideline; no immediate
    decomposition required.
  - Continue to monitor these modules; decompose if growth trends toward
    or exceed ~300 LOC in future changes.

- build(types): resolve "@/..." alias when bundling d.ts
  - rollup.config.ts: include alias plugin in buildTypes
  - effect: silences unresolved dependency warning during dts build (no behavior change)

- Imports: remove backward-compat usage; update internal modules and tests to import
  from the modular barrel "@/stan/config" (help, version, run/service, init/service,
  snap/context, patch/context, config.test). Library barrel now re-exports explicitly
  from "./config/index". Deletion of src/stan/config.ts can follow as a separate change.

- CLI runner decomposition (Phase 2, no behavior changes):
  - Added src/cli/stan/run/options.ts (options/defaults/listeners),
    src/cli/stan/run/derive.ts (selection/mode/behavior derivation),
    src/cli/stan/run/action.ts (conflicts, plan render, runSelected);
    reduced src/cli/stan/runner.ts to thin wiring.

- Phase 1 scaffolding: add modular config files under src/stan/config/ (types, defaults,
  normalize, discover, load, output, index) with no behavior changes. Existing
  imports continue to work via current src/stan/config.ts. A follow‑up will switch config.ts to re‑export from ./config to complete the split while preserving
  public API and test/build behavior.

- CLI run: fix -S vs -s/-x enforcement and TypeScript errors
  - Remove invalid `Option.conflicts(optNoScripts)` calls (TS2345) and rely on a manual guard.
  - Wire `option:*` event listeners BEFORE action to capture raw presence during parse.
  - Throw `CommanderError('commander.conflictingOption')` in action when -S is combined with -s or -x so `parseAsync` rejects as tests expect.
  - Outcome: tests pass for `-S` conflict, docs/typecheck no longer fail on TS2345.

- CLI run: remove remaining parse-time conflicts on `no-scripts` to avoid Commander self-conflict on `-S -A`; rely on manual event-based guard (with listeners wired pre-action).

- Dev mode detection: realpath‑hardened home‑repo check + overrides
  (env STAN_DEV_MODE > config devMode > detection).

- System prompt — add FEEDBACK response completeness validator (require Full Listing + improved Patch for each failed file).

- Docs — Archives & snapshots: add “Selection semantics (includes/excludes)” and example for additive `includes`.

- CLI help — tag effective defaults with “(DEFAULT)” for root and subcommands; improve root description to tell the STAN story.

- System prompt repo‑agnostic housekeeping
  - docs(system): make monolith guidance fully repo‑agnostic; direct all
    durable policy/behavior changes to the project prompt.
  - docs(system): add vocabulary alias “monolith” → `<stanPath>/system/stan.system.md`.
  - docs(system): neutralize preflight drift wording (no “downstream repos”).

- Archiving selection semantics + docs cadence enforcement
  - feat(fs): make `includes` additive and able to override `.gitignore`/excludes for specific paths; preserve reserved exclusions; keep ordering deterministic.
  - tests: extend fs.glob tests to cover additive includes even when .gitignore would exclude a match.
  - docs(project): add “Archiving & snapshot selection semantics (includes/excludes)” to stan.project.md.
  - docs(system): add a monolith refusal rule; strengthen FEEDBACK Full Listing requirement.

- System prompt hard gate enhancement
  - docs(system): add explicit Post‑compose validator requiring a Patch for
    `<stanPath>/system/stan.todo.md` whenever any code Patch is emitted
    (with deletions‑only / plan‑only exceptions) and re‑assert that the
    Commit Message is present and last (HARD GATE; MUST fail composition).

- Hotfix: fix parse error in src/stan/config.ts by removing stray “\*/;” tokens
  after two JSDoc blocks (devMode, patchOpenCommand); unblocks build/lint/
  typecheck/tests ahead of Phase 1 decomposition.

- CLI run: enforce parse‑time conflicts for -S with -s/-x using Commander
  Option.conflicts so `parseAsync` rejects with code
  `commander.conflictingOption` (fixes failing
  runner.semantics.v2 test).

- System prompt: FEEDBACK robustness
  - If FEEDBACK `summary.failed` contains only the placeholder “(patch)”, treat
    `summary.changed` as the target set and include a Full Listing plus improved
    Patch for each path.
  - After a failed apply, consider widening unified‑diff context (e.g., 5–7 lines)
    when regenerating the corrected diff to improve placement reliability.

DX / utility ideas (backlog)

- CLI/automation:
  - `stan run --plan --json` and `stan -v --json` for tool integration.
  - `stan patch --check --report` to print an affected‑files/hunks summary.
  - Optional progress timers per phase (scripts/archives) with totals.
  - Archive summary line: file count, excluded binaries, large‑text flagged.

- Patch ergonomics:
  - Adaptive context: automatically widen context margins on git/jsdiff failure (re‑try with more context).
  - Add a small preflight lint that flags aggregated multi‑file diffs before composing the final message.
  - Editor integration: open patched files at first changed line (from hunk);
    support VS Code, Cursor, WebStorm templates via config tokens.
  - Better rejects UX: on failure, surface the new `<stanPath>/patch/rejects/...` root path explicitly and offer a one‑liner to open it.

- Docs & guidance:
  - FEEDBACK envelope “causes” mapping table in docs (path/strip/EOL/context) with suggested assistant remedies.
  - Quick “what to attach” heuristics in CLI output when archives are missing.
