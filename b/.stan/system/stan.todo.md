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

- P0 — Cleanup tracked artifacts (this turn)
  - Remove any leftover tracked files that are no longer used:
    • delete `<stanPath>/output/archive.warnings.txt` if present,
    • delete the historical `<stanPath>/refactors/**` directory and
      its contents from the repository.
  - Confirm no tests/docs reference the removed artifacts.

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
- No refactor-note persistence
  - System prompt updated to commit-message workflow; code no longer
    creates or filters a refactors directory; archivers retain only
    necessary excludes (snapshots/stale archives).

Notes

- Module SRP: new code follows the “directory module + index” pattern;
  CLI adapters remain thin.
