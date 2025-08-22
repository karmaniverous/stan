# STAN Development Plan (tracked in .stan/system/stan.todo.md)

When updated: 2025-08-22 (UTC)

ALIASES

- “development plan” / “dev plan” / “implementation plan” / “todo list” → <stanPath>/system/stan.todo.md

Purpose

- Single source of truth for the current development plan across chat threads.
- The assistant updates this document as code/design advances (remove completed items).

Current plan (remaining)

- P0 — Patch discipline and warnings UX
  - Ensure all assistant‑generated patches are valid unified diffs (proper line markers and hunk counts).
  - Archive warnings UX: do not write `archive.warnings.txt`; log console summary instead.
    • Code: remove warnings file write/inclusion; print `stan: archive warnings` + body.
    • Tests: update classifier behavior test to remove warnings-file assertion.
  - (Optional) Reduce archive noise by excluding `.stan/refactors/**` via internal filters (no config change).

- P0 — Robust patch handling (remaining polish)
  - FEEDBACK envelope: include concise stderr summary (already in logs) directly in the clipboard envelope (partially done).
  - Optional DMP fallback after jsdiff (deferred).
- P1 — Preflight/version UX
  - Preflight drift nudge (TTY vs non-TTY behavior).
  - `stan -v` prints version + doc baseline info (already implemented).
- P2 — Housekeeping
  - Windows EBUSY on sandbox/patch directory teardown in one patch test: add best‑effort retry/backoff if it recurs.

Completed (since last update)

- CLI refactors (business logic out of adapters)
  - DONE: Snap — extracted handlers (undo/redo/set/info/snap) to src/stan/snap/handlers.ts. Tests continue to import registerSnap unchanged.
  - DONE: Init — extracted docs/gitignore/prompts/services under src/stan/init/\*. CLI remains a thin adapter and continues to export performInit for tests.
- Diff/snapshot policy and artifacts
  - Always-on diff with archives; snapshot policy implemented.
- Patch pipeline
  - Clean/extract from prose; tolerant git apply with -p1/-p0 and --recount; jsdiff fallback with EOL preservation; FEEDBACK clipboard + .debug/attempts.json; rejects relocation under .stan/patch/.
- Archive classifier
  - Binary exclusion; large text call-outs; write archive.warnings.txt; include in archives.

Notes

- Module SRP: new code follows the “directory module + index” guideline; CLI adapters remain thin.
- Termination rule: if the original full archive is no longer in the context window, halt and resume in a fresh chat with the latest archives (state is preserved under <stanPath>/system).
- Policies, architecture, and testing guidance live in <stanPath>/system/stan.system.md.
