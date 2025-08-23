# STAN Development Plan (tracked in .stan/system/stan.todo.md)

When updated: 2025-08-23 (UTC)

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
- Completed retention:
  - Keep only a short “Completed (recent)” list (e.g., last 3–5 items or last
    2 weeks). Prune older entries during routine updates.
  - Rely on Git history for the long‑term record of completed work.
  - When a completed item establishes a durable policy, promote that policy
    to stan.project.md and remove it from “Completed”.

Current plan (remaining)

- A) Patch service thin‑out (ensure SRP; keep orchestrator lean)
  - Extract remaining helpers from src/stan/patch/service.ts into focused modules:
    • patch/git-status.ts — maybeWarnStaged (index overlap warning)  
    • patch/detect.ts — isFeedbackEnvelope, seemsUnifiedDiff  
    • patch/util/fs.ts — ensureParentDir  
    • patch/headers.ts — pathsFromPatch (header‑derived candidates)
  - Keep service.ts as orchestration only (wire read→clean→parse→apply→diagnose→feedback).
  - Tests: extend existing suites minimally to cover new modules’ surfaces (smoke in service stays).
  - Acceptance: service.ts ~≤200 LOC; all tests green; no behavior changes.

Completed (recent)

- Patch split & tests
  - The split into run/{source,pipeline,diagnostics,feedback}.ts exists and tests are green.

- Docs/help (FEEDBACK logs)
  - README now matches console messages:
    • copied: “stan: copied patch feedback to clipboard”
    • failure: “stan: clipboard copy failed; feedback saved -> <path>”

- Snap split
  - Extracted context/history/snap-run; handlers is a thin re‑export.

- Snap split tidy
  - Removed unused variable in snap/history.ts (handleInfo) to satisfy ESLint.

- Test fixes (jsdiff + feedback copy)
  - jsdiff fallback classifies empty/nameless parse results as “invalid unified diff”.
  - FEEDBACK clipboard path treats undefined copy result as success; logs
    “stan: copied patch feedback to clipboard”.

Notes

- Termination rule: if the original full archive is no longer in the
  context window, halt and resume in a fresh chat with the latest
  archives (state is preserved under <stanPath>/system).
- Policies, architecture, and testing guidance live in
  <stanPath>/system/stan.system.md.
