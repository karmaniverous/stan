# STAN Development Plan (tracked in .stan/system/stan.todo.md)

When updated: 2025-08-26 (UTC) — add Configuration guide; add patch-before-listing policy; long‑file sweep recorded; dts alias fix; coverage excludes; monitoring near‑threshold modules

Next up (high value)

- Selection: default‑exclude sub‑packages (folders with their own package.json)
  - Implement exclusion in file selection for top‑level sub‑packages (child folders of repo root that contain a `package.json`). Repo root itself is not excluded.
  - Provide clear override via `includes` globs to re‑include specific sub‑packages.
  - Tests:
    - Extend `src/stan/fs.glob.test.ts` (or add a new test) to verify that `packages/app1` with a `package.json` is excluded by default and can be re‑included via `includes: ["packages/app1/**"]`.

- Response format validator: ensure Patch precedes Full Listing
  - Add/extend a validator in the response composition checks so that when both blocks exist for a file, the “### Patch:” block appears before the “### Full Listing:” block.
  - Acceptance:
    - Failing composition when ordering is incorrect for any file.
    - Documentation updated in project prompt (policy recorded).
    - Add a unit test for the validator (or a smoke test that asserts order).

- Compression exploration (archives & outputs)
  - Keep canonical artifacts as plain `.tar` (`archive.tar`, `archive.diff.tar`).
  - Research an optional companion `archive.tar.gz` for transport without removing the canonical `.tar`.
  - Explore output handling that preserves assistant readability (e.g., optional `outputs.summary.txt` plus compressed raw outputs, or compress only in a secondary artifact).
  - Acceptance:
    - No change to default behavior.
    - Assistant and bootloader continue to consume `.tar` artifacts as before.
    - Documentation updated and unit tests added if a prototype is adopted behind a flag/config.

- Init UX: skip script selection when preserving existing scripts
  - Interactive: if the user chooses “preserve scripts”, omit the script‑selection step and retain scripts from the existing config.
  - Non‑interactive: `--preserve-scripts` behaves identically (no selection UI).
  - Tests:
    - Update/extend `src/stan/init/prompts.test.ts` to assert that the selection step is bypassed when `preserveScripts` is true (defaults preserved), and still shown when false.

- Long‑file monitoring and decomposition (Phase 3)
  - Continue to monitor near‑threshold modules; propose splits if any
    trend toward or exceed ~300 LOC in future changes.

- Coverage follow‑ups
  - Ensure tests remain strong for src/stan/config/{discover,load,normalize,output}.
  - Target incremental gains over current ~86% lines as changes land.
  - Keep excludes limited to trivial barrels and types‑only modules.

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

- docs(config): add complete “Stan Configuration” guide under docs-src; include in typedoc projectDocuments; link from README Guides.

- docs(project): add local policy requiring Patch precede Full Listing when both are present; plan validator to enforce ordering.

- docs(cli-examples): full exposition of root/run/patch/snap/init options, conflicts, negative flags, and config-driven defaults (opts.cliDefaults); add comprehensive examples.

- docs(cli-examples): correct selection note — remove “(in config order)” from “Run specific scripts” example; CLI preserves provided order only with `-q` and uses config order only when `-s` is omitted (all scripts by default).

- build(types): resolve "@/..." alias when bundling d.ts
  - rollup.config.ts: include alias plugin in buildTypes
  - effect: silences unresolved dependency warning during dts build (no behavior change)

- coverage(config): exclude trivial barrels and types‑only modules from coverage
  - vitest.config.ts: added excludes for src/\*/index.ts and types‑only files
  - rationale: avoid skew from non‑executable glue; behavior unchanged

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

- Validation run (no code changes)
  - build/test/lint/typecheck/docs all green
  - coverage (lines): ~86.2% (>=85% target)
  - knip: OK
  - outcome: conflict handling (-c vs -A) confirmed at parse‑time; CLI semantics unchanged

- P0 cleanup (runner split follow‑through; no behavior changes)
  - fix(cli/run): resolve plan import by using service module '@/stan/run/plan' (removes bad './plan' path).
  - fix(cli/run): narrow unknown in catch and log message string only (satisfies eslint @typescript-eslint/no‑unsafe‑\*).
  - Outcome: build/typecheck/docs/knip/lint errors cleared; runner semantics unchanged.

- P0 cleanup follow‑up (no behavior changes)
  - fix(cli/run): add missing `import type { FlagPresence } from './options'` in action.ts to satisfy TS and lint.
  - fix(cli/run): enforce parse‑time conflict `-c` vs `-A` in options.ts via Option.conflicts to match test expectation.
  - Outcome: typecheck/docs/lint pass; `runner.semantics.v2` conflict test passes.

- Imports: remove backward‑compat usage; update internal modules and tests to import
  from the modular barrel "@/stan/config" (help, version, run/service, init/service,
  snap/context, patch/context, config.test). Library barrel now re‑exports explicitly
  from "./config/index". Deletion of src/stan/config.ts can follow as a separate change.

- CLI runner decomposition (Phase 2, no behavior changes)
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

- CLI run: remove remaining parse‑time conflicts on `no‑scripts` to avoid Commander self‑conflict on `-S -A`; rely on manual event‑based guard (with listeners wired pre‑action).

- Dev mode detection: realpath‑hardened home‑repo check + overrides (env STAN_DEV_MODE > config devMode > detection).

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
