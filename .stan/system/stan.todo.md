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

Completed (since last update)

- P0 — Patching DX (#1–#3)
  - Worktree‑only applies: removed any index‑verified/staging behavior; tolerant git apply across p1→p0, then jsdiff fallback.
  - Unified success log: “stan: patch applied” (no staged/unstaged wording).
  - Early input sanity checks:
    • Abort for BEGIN_STAN_PATCH_FEEDBACK envelopes with clear guidance.  
    • Abort non‑diff inputs with helpful message describing expected headers.
  - Terminal status on early aborts:
    • Log “stan: patch failed” so CLI tests/UX receive a terminal status line.
  - Clipboard feedback logging:
    • On success: “stan: copied patch feedback to clipboard.”  
    • On failure: “stan: clipboard copy failed; feedback saved -> <path>”.  
    • FEEDBACK content is not printed to console.
  - Test alignment: jsdiff fallback test updated to consume unified success log.

- Docs: Added “Getting started” to README, including guidance to exclude
  `<stanPath>` (default `.stan`) from ESLint (flat config ignores).

- Archive classifier
  - Binary exclusion; large text call-outs; archive warnings log to
    console (no output file).

- Diff/snapshot policy and artifacts
  - Always-on diff with archives; snapshot policy implemented; snap
    history with undo/redo/set/info.

- Preflight/version UX
  - `stan -v` prints version + doc baseline info; preflight drift warnings (TTY vs non‑TTY)
    implemented and tested.

- Lint/exports cleanup
  - Removed redundant default exports (kept named exports) to resolve
    knip duplicate-exports warnings in:
    • src/stan/patch/run/diagnostics.ts  
    • src/stan/patch/run/feedback.ts  
    • src/stan/patch/run/pipeline.ts  
    • src/stan/patch/run/source.ts

Notes

- Module SRP: service split remains the next step to get service.ts under 300 LOC.
- Termination rule: if the original full archive is no longer in the
  context window, halt and resume in a fresh chat with the latest
  archives (state is preserved under <stanPath>/system).
- Policies, architecture, and testing guidance live in
  <stanPath>/system/stan.system.md.
