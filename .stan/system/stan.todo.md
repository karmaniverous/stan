# STAN Development Plan (tracked in .stan/system/stan.todo.md)

When updated: 2025-08-26 (UTC)

Next up (high value)

- Long-file sweep and decomposition plan
  - Results (approximate LOC; bytes/60 heuristic):
    - src/stan/config.ts (~34 KB) ≈ ~560–590 LOC — exceeds 300 LOC (priority P0).
    - src/cli/stan/runner.ts (~25 KB) ≈ ~400–430 LOC — exceeds 300 LOC (priority P1).
    - Near threshold (monitor; likely <300): src/stan/run/archive.ts (~17.6 KB), src/stan/diff.ts (~14.1 KB),
      src/stan/fs.ts (~13.4 KB), src/stan/version.ts (~13.5 KB), src/cli/stan/index.ts (~14.2 KB).
  - Phase 1 (P0): Split src/stan/config.ts into a folder with cohesive modules (no external API change):
    - src/stan/config/types.ts: ScriptMap, ContextConfig, CLI defaults types; defaults/constants.
    - src/stan/config/normalize.ts: asString/asBool/asStringArray, normalizeMaxUndos, normalizeCliDefaults.
    - src/stan/config/load.ts: parseFile, config discovery (findConfigPathSync), loadConfigSync/async,
      resolveStanPathSync/async.
    - src/stan/config/output.ts: ensureOutputDir.
    - src/stan/config/index.ts: re‑export the public API so imports of "@/stan/config" continue to work.
    - Acceptance: build/lint/typecheck/tests green; no consumer import path changes required.
  - Phase 2 (P1): Decompose src/cli/stan/runner.ts (CLI adapter only) into smaller units:
    - src/cli/stan/run/options.ts: option construction, default tagging, conflict wiring.
    - src/cli/stan/run/derive.ts: deriveRunInvocation wrapper + config-default application.
    - src/cli/stan/run/action.ts: action handler (plan rendering + runSelected invocation).
    - src/cli/stan/runner.ts: thin registration shell (wires the above).
    - Acceptance: CLI behavior unchanged (help footer, defaults, conflicts), tests green.
  - Phase 3 (monitor): Re‑scan near-threshold modules after Phase 1–2; split if any exceed ~300 LOC in practice.

- Patch reliability for Markdown/docs:
  - If git/jsdiff both fail and exactly one contiguous section is changed in a
    .md file, consider a safe, heading‑anchored section‑replacement fallback
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

- CLI run: fix spurious self-conflict when parsing `stan run -S -A` by removing reverse conflicts wiring for `no-scripts`; retain manual `-S` vs `-s`/`-x` guard. Restores expected “plan only” behavior; runner.semantics.v2 test passes.

- CLI run: remove remaining parse-time conflicts on `no-scripts` to avoid Commander self-conflict on `-S -A`; rely solely on manual event-based guard for `-S` vs `-s`/`-x`.

- CLI run: reintroduce parse‑time conflicts on positive selectors only
  (`scripts`, `except-scripts` conflict with `no-scripts` by Option instance)
  to restore expected rejection for `-S` with `-s`/`-x` while keeping `-S -A` OK.

- Dev mode detection: realpath‑hardened home‑repo check + overrides
  (env STAN_DEV_MODE > config devMode > detection).- System prompt — add FEEDBACK response completeness validator (require Full Listing + improved Patch for each failed file).- Docs — Archives & snapshots: add “Selection semantics (includes/excludes)” and example for additive `includes`.- CLI help — tag effective defaults with “(DEFAULT)” for root and subcommands; improve root description to tell the STAN story.- System prompt repo‑agnostic housekeeping
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
