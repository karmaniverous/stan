# STAN Development Plan (tracked in .stan/system/stan.todo.md)

When updated: 2025-08-24 (UTC)

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
  - When a completed item establishes a durable policy, capture that policy
    here (project prompt) and remove it from “Completed”.

Near-term exploration

- After patch “open files”: explore returning terminal focus (CLI) cross‑platform (macOS open -g, Windows start/min/VSC integration). Defer until feasibility is clear.

- Low priority: Investigate sporadic patch failures on long Markdown files (e.g., .stan/system/stan.todo.md)
  - Observation: patch application is reliable overall; when failures occur they are more likely on very long Markdown files.
  - Status: low priority; no immediate action. Track frequency; later consider chunked updates or increased context for Markdown diffs.

Completed (recent)

- CLI: new stan run semantics (default scripts+archive) + flags
  - Added -p/--plan to print run plan and exit 0 (no side effects).
  - Added -S/--no-scripts (opt out of scripts) with conflicts vs -s/-x.
  - Added -A/--no-archive (opt out of archives) with conflicts vs -a and -c.
  - Removed the old “one of -a/-s/-x required” guard (breaking; pre‑1.0 OK).
  - Defaults: no flags → run all scripts, write archives.
  - Tests: new CLI semantics tests; plan-only path; conflict handling.

- Patch UX: status banners + compact summary
  - Introduced a tiny status helper (TTY vs BORING):
    • success: ✔ / [OK], failure: ✖ / [FAIL], partial: △ / [PARTIAL].
  - service.ts now prints status lines and a compact summary on failure:
    “tried: …; jsdiff ok: N, failed: M”.
  - Updated CLI patch tests to match the new status lines.

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

Open (low priority)

- Investigate rare patch failures on very long Markdown files (e.g., dev plan)
  - Track frequency; consider chunked updates or higher context margins later.

Next up (high value)

- README and CLI help updates
  - Refresh “Run” documentation to reflect new defaults (-p/-S/-A; default archiving; removed old guard).
  - Update examples in README and any CLI help footers if needed.

- Console styling follow-through
  - Consider applying bracketed/colored tags consistently to FEEDBACK and diagnostics logs.
  - Extend status helper coverage where appropriate.
