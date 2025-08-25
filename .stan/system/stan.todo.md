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

- No refactor-note files are to be written or persisted under
  <stanPath>/refactors.
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

Completed (recent)

- Handoff re‑trigger guard
  - Prevent generating a new handoff when a prior handoff block is pasted;
    treat it as input and proceed with the startup checklist unless explicitly
    asked for a new handoff.

- Handoff policy
  - Codified cross‑thread handoff behavior in system prompt:
    self‑identifying code block, required sections, trigger semantics.

- Archive build assembles system monolith (dev repo only)
  - Updated archive phase to assemble .stan/system/stan.system.md from parts
    when running in @karmaniverous/stan; downstream repos continue to archive
    the packaged baseline (unchanged). Avoids patching the monolith directly
    while keeping archives reproducible.

- README trim
  - Shortened README to focus on value, quick start, and links to docs.
  - Moved deep/volatile details to the documentation site and prompts.  - Preserved install/usage essentials and troubleshooting pointers.

- Always‑on prompt checks (assistant loop)
  - Enshrined in system prompt as `.stan/system/parts/45-always-on-checks.md`
    (assembled into `stan.system.md`).
  - CLI preflight already runs at the start of `stan run`, `stan snap`, and `stan patch`; no further tooling changes required at this time.
  - Assistant will, on every turn: (1) propose system‑prompt updates only in the STAN repo, (2) promote repo‑specific rules to `stan.project.md`, and (3) update `stan.todo.md` with each material change set.

DX / utility ideas (backlog)

- CLI/automation:
  - `stan run --plan --json` and `stan -v --json` for tool integration.
  - `stan patch --check --report` to print an affected‑files/hunks summary.
  - Optional progress timers per phase (scripts/archives) with totals.
  - Archive summary line: file count, excluded binaries, large‑text flagged.

- Patch ergonomics:
  - Adaptive context: automatically widen context margins on git/jsdiff failure (re‑try with more context).
  - Editor integration: open patched files at first changed line (from hunk);
    support VS Code, Cursor, WebStorm templates via config tokens.
  - Better rejects UX: on failure, surface the new `<stanPath>/patch/rejects/...` root path explicitly and offer a one‑liner to open it.

- Snap/history:
  - `stan snap info --json` for UI/CI consumers.
  - Optional snapshot labels (names) to aid navigation.
  - Always capture archives alongside snapshots when `--archive` ran since the last snap (configurable).

- Docs & guidance:
  - FEEDBACK envelope “causes” mapping table in docs (path/strip/EOL/context) with suggested assistant remedies.
  - Quick “what to attach” heuristics in CLI output when archives are missing.

Notes: Patch generation learnings (process)
- Prefer small, anchored hunks with a/ and b/ prefixes and ≥3 lines of context.
- Avoid relying on index headers; target working tree content.
- One file per diff block; repeat per file when multiple updates are needed.
- For large Markdown insertions, consider smaller appended blocks or fall back to Full Listing for wholesale rewrites.