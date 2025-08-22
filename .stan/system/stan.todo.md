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

- P0 — Remove refactor-note persistence (this turn)
  - Stop creating or populating <stanPath>/refactors entirely.
  - Remove code paths that reference <stanPath>/refactors (writers,
    cleaners, or special-case handling).
  - Replace “refactor note” output with a commit message emitted in
    chat after each change set (≤ 50 char subject; 72-col wrapped
    body).
  - Update documentation to reflect the commit-message workflow.

- P0 — Archive sanity (related)
  - Rely on the absence of <stanPath>/refactors; do not add or keep
    special-purpose excludes for it in archivers.
  - Verify that both non-combine and combine runs (`stan run -a` and
    `stan run -a -c`) never show refactor files in
    <stanPath>/output/archive.tar or archive.diff.tar (since they will
    not exist).
  - Adjust/trim any lingering, now-irrelevant code comments and tests
    that assumed refactor-note persistence.

- P0 — Patch pipeline (ongoing)
  - FEEDBACK envelope: keep concise last-error snippet (present).
  - jsdiff fallback: stable (present); optional DMP deferred.
  - Sandbox retention: bounded (present).

- P1 — Preflight/version UX
  - Preflight drift nudge (TTY vs non-TTY behavior).
  - `stan -v` prints version + doc baseline info (present).

- P2 — Housekeeping
  - Windows EBUSY mitigation remains (temporary cwd + retries where
    needed).
  - Keep archive warnings console-only (present).
  - Ensure new code follows SRP and 300‑LOC guidance.

Completed (since last update)

- Docs: Added “Getting started” to README, including guidance to exclude
  `<stanPath>` (default `.stan`) from ESLint (flat config ignores).


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
    <stanPath>/patch/.
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
