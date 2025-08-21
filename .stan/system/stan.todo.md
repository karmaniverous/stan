# STAN Development Plan (tracked in .stan/system/stan.todo.md)

When updated: 2025-08-22 (UTC)

ALIASES

- “development plan” / “dev plan” / “implementation plan” / “todo list” → <stanPath>/system/stan.todo.md

Purpose

- Single source of truth for the current development plan across chat threads.
- The assistant updates this document as code/design advances (remove completed items).

Current plan (remaining)

- P0 — CLI refactors (business logic out of adapters)
  - Snap: extract a service (create/replace snapshot, undo/redo/set/info), keep CLI thin. Tests: keep adapter smoke tests + add focused unit tests for the service.
  - Init: extract a service (config write, .gitignore, docs copy + .docs.meta.json, optional snapshot). Keep CLI as an adapter.

- Housekeeping
  - Windows EBUSY on sandbox/patch directory teardown in one patch test: add best‑effort retry/backoff on rm in the test helper if it recurs.

Notes

- Run module layout now complies with the TypeScript module index guideline (src/stan/run/index.ts replaces src/stan/run.ts).
- Termination rule: if the original full archive is no longer in the context window, halt and resume in a fresh chat with the latest archives (state is preserved under <stanPath>/system).
- Policies, architecture, and testing guidance live in <stanPath>/system/stan.system.md.
