# STAN Development Plan (tracked in .stan/system/stan.todo.md)

When updated: 2025-08-22 (UTC)

ALIASES

- “development plan” / “dev plan” / “implementation plan” / “todo list”
  → <stanPath>/system/stan.todo.md

Purpose

- Single source of truth for the current development plan across chat
  threads.
- The assistant updates this document as code/design advances (remove
  completed items).

Plan management policy

- No refactor-note files are to be written or persisted under
  <stanPath>/refactors.
- At the end of any change set, the assistant provides a commit message
  (first line ≤ 50 chars; body wrapped at 72).

Current plan (remaining)

- P0 — Patch pipeline (ongoing)
  - FEEDBACK envelope: keep concise last-error snippet (present).
  - jsdiff fallback: stable (present); optional DMP deferred.
  - Sandbox retention: bounded (present).

- P1 — Preflight/version UX
  - `stan -v` prints version + doc baseline info (present).

- P2 — Housekeeping
  - Windows EBUSY mitigation remains (temporary cwd + retries where
    needed).
  - Keep archive warnings console-only (present).
  - Ensure new code follows SRP and 300‑LOC guidance.

Completed (since last update)

- Docs: Added “Getting started” to README, including guidance to exclude
  `<stanPath>` (default `.stan`) from ESLint (flat config ignores).

- P0 — Removed refactor-note persistence
  - No `<stanPath>/refactors` directory is created or referenced by code.
  - Commit‑message workflow is documented in the system prompt; no “refactor
    note” files are written anywhere.

- P0 — Archive sanity verification
  - Archivers contain no refactor‑specific excludes.
  - Combine and non‑combine modes produce archives without any refactor
    artifacts (confirmed by code/tests).

- P1 — Preflight drift nudge (TTY vs non-TTY)
  - TTY: multi‑line guidance about drift and where to place edits.
  - Non‑TTY: concise single‑line notices suitable for CI/logs.

- CLI refactors (services-first; adapters thin)
  - Snap handlers split; init/patch split; run split into services +
    pure plan rendering.
- Diff/snapshot policy and artifacts
  - Always-on diff with archives; snapshot policy implemented; snap
    history with undo/redo/set/info.
- Patch pipeline robustness
  - Clean/extract from prose; tolerant git apply with p1/p0 and
    --recount; jsdiff fallback with CRLF preservation; FEEDBACK
    clipboard + .debug/attempts.json; rejects relocated under
    <stanPath>/patch/>.
- Archive classifier
  - Binary exclusion; large text call-outs; archive warnings log to
    console (no output file).

Notes

- Module SRP: new code follows the “directory module + index” pattern;
  CLI adapters remain thin.
- Termination rule: if the original full archive is no longer in the
  context window, halt and resume in a fresh chat with the latest
  archives (state is preserved under <stanPath>/system).
- Policies, architecture, and testing guidance live in
  <stanPath>/system/stan.system.md.
