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

- B) ESLint and prompt updates
  - ESLint: Confirm @typescript-eslint/require-await is OFF for **/\*.test.ts(x), unchanged for src/**.
  - System prompt:
    • Add system‑level lint policy (tool‑agnostic).  
    • Add explicit “Enforcement” under the 300‑line guidance:
    − When a module exceeds ~300 LOC, propose a split or justify exceptions; record in the dev plan.

- C) Docs/help
  - Update stan patch help/README:
    • Unified diffs only; FEEDBACK is for the AI loop, not for stan patch apply.  
    • Worktree applies only; git index is never required.  
    • Clipboard: file path is always printed; if copy fails, clear message with saved path.  
    • (Optional) STAN_NO_CLIPBOARD env toggle docs if added.

Completed (recent)

- Graceful jsdiff parse errors
  - applyWithJsDiff no longer throws on invalid/unparseable diffs; returns a failure outcome
    so the pipeline can generate diagnostics/FEEDBACK instead of crashing.

- Clipboard fallback logging
  - copyToClipboard now reports success/failure; persistFeedbackAndClipboard logs
    “copied to clipboard” on success and “clipboard copy failed; feedback saved -> <path>”
    on failure. Tests cover both paths.

- Service smoke test
  - Added src/stan/patch/service.smoke.test.ts to validate runPatch
    success path and logging (“stan: patch applied”).

- Test fixes (jsdiff + feedback copy)
  - jsdiff fallback now classifies empty/nameless parse results as “invalid unified diff”.
  - FEEDBACK clipboard path treats undefined copy result as success; logs
    “stan: copied patch feedback to clipboard”.

Notes

- Module SRP: service split remains the next step to get service.ts under 300 LOC.
- Termination rule: if the original full archive is no longer in the
  context window, halt and resume in a fresh chat with the latest
  archives (state is preserved under <stanPath>/system).
- Policies, architecture, and testing guidance live in
  <stanPath>/system/stan.system.md.
