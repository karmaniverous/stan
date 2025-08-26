# STAN Development Plan (tracked in .stan/system/stan.todo.md)

When updated: 2025-08-25 (UTC)

ALIASES

- “development plan” / “dev plan” / “implementation plan” / “todo list”
  → <stanPath>/system/stan.todo.md

Purpose

- Single source of truth for the current development plan across chat
  threads.
- The assistant updates this document as code/design advances (remove
  completed items).

Output & formatting policy

- Full Listings are available on request and should not be emitted by default
  (conserves context window).
- Always include a “Commit Message” section header above the fenced commit text
  at the end of replies.

Plan management policy

- At the end of any change set, the assistant provides a commit message
  (first line ≤ 50 chars; body wrapped at 72).
- Completed retention:
  - Keep only a short “Completed (recent)” list (e.g., last 3–5 items or last
    2 weeks). Prune older entries during routine updates.
  - Rely on Git history for the long‑term record of completed work.
  - When a completed item establishes a durable policy, capture that policy
    here (project prompt) and remove it from “Completed”.

Next up (high value)

- Patch reliability for Markdown/docs:
  - If git/jsdiff both fail and exactly one contiguous section is changed in a
    .md file, consider a safe, heading‑anchored section‑replacement fallback
    (anchor on H2/H3 heading, replace through next same‑level heading).
    Validate under --check/sandbox first; preserve whitespace; normalize EOL.
    Ship only if demonstrably safe.

- Assistant output discipline
  - Keep Full Listings out of default replies (on‑request only) to preserve
    context window. Continue to emit robust patches with adequate context.
  - Require a “Commit Message” section header over the fenced commit text.

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

- Archiving selection semantics + docs cadence enforcement
  - feat(fs): make `includes` additive and able to override `.gitignore`/excludes for specific paths; preserve reserved exclusions; keep ordering deterministic.
  - tests: extend fs.glob tests to cover additive includes even when .gitignore would exclude a match.
  - docs(project): add “Archiving & snapshot selection semantics (includes/excludes)” to stan.project.md.
  - docs(system): add a monolith refusal rule; strengthen FEEDBACK Full Listing requirement.
  - docs(system): add a post‑compose verification checklist to enforce fence hygiene and commit isolation.

Next up (follow‑through)

- Public docs: surface the new additive‑includes rule in the website guide (“Archives & snapshots”) with a short example.

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

Notes: Patch generation learnings (process)

- Prefer small, anchored hunks with a/ and b/ prefixes and ≥3 lines of context.
- Avoid relying on index headers; target working tree content.
- One file per diff block; repeat per file when multiple updates are needed.
- For large Markdown insertions, consider smaller appended blocks or fall back to Full Listing for wholesale rewrites.
