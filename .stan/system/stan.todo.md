# STAN Development Plan (tracked in .stan/system/stan.todo.md)

When updated: 2025-08-29 (UTC) — selection precedence updated: excludes > includes > gitignore; code/tests updated. Diff archive continues to apply binary-screening classifier; validator/doc-cadence unchanged.

Next up (high value)
<!-- validator moved to Completed (initial library). Integration into composition remains a separate track and will be planned when the composition layer is introduced in-repo. -->

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

- selection precedence: config excludes > includes > gitignore
  - code: src/stan/fs.ts — `filterFiles` now applies additive `includes`
    over .gitignore/default denials but applies user `excludes` last so
    they win over includes. Reserved exclusions unchanged.
  - tests: added coverage in src/stan/fs.glob.test.ts to prove excludes
    override includes and includes override .gitignore.
- response‑format validator (initial library + tests)
  - code: added `src/stan/validate/response.ts` with checks:
    - one Patch per file,    - “Patch” precedes “Full Listing” when both present for a file,
    - presence of “## Commit Message” last,
    - TODO patch present when any Patch exists.
  - tests: `src/stan/validate/response.test.ts`.
  - export: validator is available via `@/stan/validate/response`.
- tests/robustness: improved multi‑diff test generation to replace the entire section,
  and made the assertion tolerant (“contains multiple …”). Commit‑last check now uses
  heading order (final section) to avoid brittle fence parsing.
- system prompt (FEEDBACK): add explicit rule to anchor hunks for docs/text files on
  stable structural markers and keep the blast radius minimal (single, well‑anchored
  hunk when possible).
- validator: align commit‑last message and guard commit‑only replies
  - tests expect an error matching `/Commit Message.*not last/`; error text updated to
    “Commit Message is not last” to stabilize the check.
  - commit‑only replies are now considered invalid by this library (adds
    “No Patch blocks found”), ensuring validateOrThrow throws with a readable message.

- validator: fix syntax/brace error and restore TODO cadence check
  - code: repaired commented‑out `if (patches.length > 0)` and extra closing brace,
    preventing build/test/docs failures and ensuring the TODO gate runs conditionally. stable structural markers and keep the blast radius minimal (single, well‑anchored
    hunk when possible).
- process guarantee: enforce doc‑cadence every turn
  - policy: replies that contain any Patch must also include a Patch to `.stan/system/stan.todo.md` and a final “Commit Message” block (hard gate).
  - validator (near‑term): add a response‑format validator that fails composition when the doc‑cadence gate or the Patch/Full‑Listing order per file is violated.
  - tests: add unit/smoke tests for the validator to prevent regressions.- snap: stash/pop confirmations and test
  - code: `handleSnap` logs “stash saved changes”, “no local changes to stash”, and “stash pop restored changes”.
  - tests: added isolated success suite (`src/cli/stan/snap.stash.success.test.ts`) that resets modules before importing CLI to avoid cross‑suite mock interference.
  - outcome: clearer operator feedback for `stan snap -s`; tests are stable and isolated from existing stash‑failure suite.

- config: move CLI defaults to top-level cliDefaults; drop opts wrapper
  - code: types/load/index/cli refs updated; CLI run/patch/snap/root defaults now read cliDefaults.
  - tests: YAML fixtures updated to cliDefaults.
  - docs: configuration and CLI examples updated to cliDefaults and new precedence wording.
  - policy: .stan/system/stan.project.md updated to reflect cliDefaults schema.
  - compatibility: no support for legacy opts.cliDefaults (breaking change by design).

- handoff: first‑message guard and fence‑agnostic detection
  - system prompt (parts): added hard “first message of thread” guard — never emit a new handoff in response to the first user message; treat as startup input.
  - detection: recognize pasted handoffs by title line “Handoff — …” with or without code fences; allow additional user instructions before/after.
  - validator: expanded post‑compose checklist to include first‑message guard and non‑trigger rules; suppress new handoff unless explicitly requested later in the thread.
  - outcome: assistants will not respond to a pasted (or first‑message) handoff with another handoff; they resume with the startup checklist instead.

- selection: default‑exclude nested sub‑packages; re‑include via includes
  - code: src/stan/fs.ts — exclude any directory (at any depth) that contains its own `package.json`; repo root not excluded; reserved STAN workspace exclusions unchanged.
  - tests: added src/stan/fs.subpackages.test.ts to verify default exclusion and re‑include with includes: ["packages/app1/**"].
  - docs: updated docs-src/configuration.md to document the behavior and re‑include pattern.

- fixes: resolve parse/type/lint errors blocking build/docs
  - src/cli/stan/snap.ts — fixed missing brace and formatting.
  - src/stan/config/types.ts — closed CliDefaults type.
  - outcome: typecheck/lint/docs unblock; tests run clean for affected areas.

- init: preserve existing config keys and cliDefaults; maintain order
  - behavior:
    - When a config exists, stan init now merges user answers into the existing document,
      preserving unknown keys (e.g., cliDefaults), key order, and formatting (file type).
    - Writes back to the same config path/format (json|yml|yaml).
    - Migrates legacy opts.cliDefaults to top‑level cliDefaults and removes empty opts.
    - --force is non‑destructive when a config exists (only migrates/ensures required keys).
  - implementation:
    - src/stan/init/service.ts loads raw config (YAML.parse), merges answers, and serializes using
      the existing file’s extension; preserves insertion order to avoid key reordering.
  - result: no unintended deletion of cliDefaults; only obsolete keys removed or required ones added.

- init: fix ESLint no-unsafe-assignment in config loader
  - change: type the result of YAML.parse as unknown and narrow before assigning
    to typed structures in src/stan/init/service.ts.
  - outcome: lint passes without weakening types; behavior unchanged.

- init UX: default “Preserve existing scripts” to Yes; skip selection when preserving
  - Change: the interactive confirm now defaults to Yes; when preserving scripts, the
    package.json script selection checklist is hidden.
  - Implementation:
    - src/stan/init/prompts.ts — confirm default set to `true`; added `when` to
      conditionally present selection only when not preserving.
  - Notes:
    - CLI `--preserve-scripts` continues to behave as before; this change affects
      interactive defaults and UX only.
    - Existing tests remain valid; follow‑up tests can assert skip behavior via
      prompt mocks.

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
