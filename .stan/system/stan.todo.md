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

Near-term exploration

- After patch “open files”: explore returning terminal focus (CLI) cross‑platform (macOS open -g, Windows start/min/VSC integration). Defer until feasibility is clear.

- Low priority: Investigate sporadic patch failures on long Markdown files (e.g., .stan/system/stan.todo.md)
  - Observation: patch application is reliable overall; when failures occur they are more likely on very long Markdown files.
  - Status: low priority; no immediate action. Track frequency; later consider chunked updates or increased context for Markdown diffs.

Completed (recent)

- Patch service thin‑out (SRP; orchestrator only)
  - Audit: src/stan/patch/service.ts serves as a lean orchestrator (~200 LOC),
    delegating to focused helpers already present:
    detect.ts, headers.ts, git-status.ts, util/fs.ts, and run/{source,pipeline,
    diagnostics,feedback}. Tests are green; no behavior changes observed.
  - Outcome meets acceptance: small orchestrator, helpers extracted, behavior
    unchanged.

- Docs: Simplified loop diagram & path update
  - Replaced the detailed diagram with a three‑stage state diagram focused on
    the core loop (“Build & Snapshot” → “Share & Baseline” → “Discuss & Patch”).
  - Moved source to diagrams/stan-loop.pu and updated README to reference
    diagrams/stan-loop.svg.

- Open target files on patch failure
  - When a patch fails (non‑--check), open the target file(s) derived from
    headers to aid manual fixes.

- FEEDBACK clipboard (test guard)
  - Skip clipboard writes under NODE_ENV=test unless STAN_FORCE_CLIPBOARD=1,
    preventing hangs and Windows teardown errors in CI.

- Project prompt: document patch editor‑open behavior
  - Added success/failure editor‑open details and configuration pointers to
    `.stan/system/stan.project.md` under the “stan patch” section.

- Lint fix (patch service)
  - Removed unnecessary `await` before `openFilesInEditor` in
    src/stan/patch/service.ts to satisfy @typescript-eslint/await-thenable.
    No behavior change.
- Global CLI flags
  - Added `-b/--boring` to disable colorized output (useful for tests and CI).
    Wired via environment (STAN_BORING/NO_COLOR/FORCE_COLOR) and documented in
    README. Color usage routed through a small util.

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
