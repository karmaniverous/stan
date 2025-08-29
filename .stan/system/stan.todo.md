# STAN Development Plan (tracked in .stan/system/stan.todo.md)

When updated: 2025-08-29 (UTC) — fix tests/docs build (remove unused ts-expect-error; add package.json in discover test); pruned Completed and refreshed Next up.

Next up (high value)

<!-- validator moved to Completed (initial library). Integration into composition remains a separate track and will be planned when the composition layer is introduced in-repo. -->

- Long‑file monitoring and decomposition (Phase 3)
  - Continue to monitor near‑threshold modules; propose splits if any
    trend toward or exceed ~300 LOC in future changes.

- Coverage follow‑ups
  - Ensure tests remain strong for src/stan/config/{discover/load/normalize/output};
    consider small additional cases for load.ts branches as needed.
  - Target incremental gains over ~86% lines coverage as changes land.
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
  - Editor integration: open patched files at first changed line (from hunk);
    support VS Code, Cursor, WebStorm templates via config tokens.
  - Better rejects UX: on failure, surface the new `<stanPath>/patch/rejects/...` root path explicitly and offer a one‑liner to open it.

- Docs & guidance:
  - FEEDBACK envelope “causes” mapping table in docs (path/strip/EOL/context) with suggested assistant remedies.
  - Quick “what to attach” heuristics in CLI output when archives are missing.
