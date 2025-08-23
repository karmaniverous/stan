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

- A) Patch module split and tests
  - Split src/stan/patch/service.ts (>300 LOC) into focused modules:
    • src/stan/patch/run/source.ts — resolve source (clipboard/file/arg) + read  
    • src/stan/patch/run/pipeline.ts — worktree git‑apply attempts + jsdiff fallback  
    • src/stan/patch/run/diagnostics.ts — write attempts.json and per‑attempt logs  
    • src/stan/patch/run/feedback.ts — build/persist FEEDBACK + clipboard log
  - Keep service.ts as thin orchestration only.
  - Add tests:
    • run/source.test.ts — source precedence, error handling  
    • run/pipeline.test.ts — untracked and modified‑but‑unstaged files; capture failures  
    • run/diagnostics.test.ts — attempts.json + per‑attempt logs  
    • run/feedback.test.ts — FEEDBACK write + clipboard logging (success/failure)
  - Update service smoke test to validate orchestration/logs; keep suite green.

Completed (recent)

- Prompt & lint emphasis
  - Confirmed @typescript-eslint/require-await is OFF for tests; no change needed for src/\*\*.
  - System prompt already contained doc conventions and pruning policy.

- Docs/help (FEEDBACK logs)
  - README updated to match console messages:
    • copied: “stan: copied patch feedback to clipboard”
    • failure: “stan: clipboard copy failed; feedback saved -> <path>”

- Snap split
  - Extracted context/history/snap-run; handlers is a thin re-export.

- Snap split tidy
  - Removed unused variable in snap/history.ts (handleInfo) to satisfy ESLint.

- Test fixes (jsdiff + feedback copy)
  - jsdiff fallback now classifies empty/nameless parse results as “invalid unified diff”.
  - FEEDBACK clipboard path treats undefined copy result as success; logs
    “stan: copied patch feedback to clipboard”.

- Service smoke test
  - Added src/stan/patch/service.smoke.test.ts to validate runPatch
    success path and logging (“stan: patch applied”).

- Clipboard fallback logging
  - copyToClipboard now reports success/failure; persistFeedbackAndClipboard logs
    “copied to clipboard” on success and “clipboard copy failed; feedback saved -> <path>”
    on failure. Tests cover both paths.

- Graceful jsdiff parse errors
  - applyWithJsDiff no longer throws on invalid/unparseable diffs; returns a failure outcome
    so the pipeline can generate diagnostics/FEEDBACK instead of crashing.

Notes

- Module SRP: service split remains the next step to get service.ts under 300 LOC.
- Termination rule: if the original full archive is no longer in the
  context window, halt and resume in a fresh chat with the latest
  archives (state is preserved under <stanPath>/system).
- Policies, architecture, and testing guidance live in
  <stanPath>/system/stan.system.md.
