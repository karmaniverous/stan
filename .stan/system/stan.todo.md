# STAN Development Plan (tracked in .stan/system/stan.todo.md)

When updated: 2025-08-25 (UTC)

ALIASES

- “development plan” / “dev plan” / “implementation plan” / “todo list”
  → <stanPath>/system/stan.todo.md

Purpose

- Single source of truth for the current development plan across chat
  threads.
- The assistant updates this document as code/design advances (remove
  completed items).

Output & formatting policy

- Full Listings are available on request and should not be emitted by default
  (conserves context window).
- Always include a “Commit Message” section header above the fenced commit text
  at the end of replies.

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

- Patch reliability for Markdown/docs:
  - If git/jsdiff both fail and exactly one contiguous section is changed in a
    .md file, consider a safe, heading‑anchored section‑replacement fallback
    (anchor on H2/H3 heading, replace through next same‑level heading).
    Validate under --check/sandbox first; preserve whitespace; normalize EOL.
    Ship only if demonstrably safe.

- Assistant output discipline
  - Keep Full Listings out of default replies (on‑request only) to preserve
    context window. Continue to emit robust patches with adequate context.
  - Require a “Commit Message” section header over the fenced commit text.

- After patch “open files”: explore returning terminal focus (CLI) cross‑platform (macOS open -g, Windows start/min/VSC integration). Defer until feasibility is clear.

- Low priority: Investigate sporadic patch failures on long Markdown files (e.g., .stan/system/stan.todo.md)
  - Observation: patch application is reliable overall; when failures occur they are more likely on very long Markdown files.
  - Status: low priority; no immediate action. Track frequency; later consider chunked updates or higher context margins.

Completed (recent)

- Always‑on prompt checks (assistant loop)
  - Enshrined in system prompt as `.stan/system/parts/45-always-on-checks.md` (assembled into `stan.system.md`).
  - CLI preflight already runs at the start of `stan run`, `stan snap`, and `stan patch`; no further tooling changes required at this time.
  - Assistant will, on every turn: (1) propose system‑prompt updates only in the STAN repo, (2) promote repo‑specific rules to `stan.project.md`, and (3) update `stan.todo.md` with each material change set.

- Tests: fix Windows EBUSY in open.test.ts
  - Ensure per‑test teardown chdirs to os.tmpdir() before removing temp dirs to avoid EBUSY.
  - Restore missing `const calls: string[] = [];` in the spawn mock.

- System prompt split (incremental)
  - Split monolith into ordered parts under `.stan/system/parts/`
    (00-intro, 10-foundations, 20-intake, 30-critical-coverage-layout,
    40-doc-and-feedback, 50-patch-policy, 60-archives-preflight, 70-default-and-reqs, 90-response-format) and enabled assembly via `gen:system`. Verified assembled monolith matches content.

- Patch engine hardening for docs
  - git apply: add `--inaccurate-eof` to all attempts (p1→p0 variants). - jsdiff: allow minimal `fuzzFactor` for `.md` only to tolerate tiny reflows.

- System prompt: add explicit “Commit Message” heading in the Response Format.

- Infra: add system‑prompt assembly (parts -> monolith)
  - Introduced gen-system.ts and wired it as prebuild. No content split yet;
    supports incremental migration by adding `.stan/system/parts/*.md`.

- Policy: README trim‑and‑link
  - Documented in project prompt; keep README concise and move deep topics
    to docs, linked from README.

- Knip config: remove redundant ignoreDependencies entry ("auto-changelog").

- Docs: README additions for “API docs and TSDoc” + “Contributing docs style”
  - Clarifies how to run docs generation and contributor TSDoc expectations.

- TSDoc Phase 1 on core APIs (no behavior changes)
  - Added/expanded TSDoc for: config, fs, archive, diff, run plan/exec/service,
    help, version, patch/open.
  - Outcome: TypeDoc/ESLint surface warnings only (formatting), no errors.

- TSDoc hygiene fix pass (warnings → zero)
  - Normalized @param tags with hyphen, avoided dotted names, escaped “>”.
  - Result: TypeDoc and ESLint TSDoc clean (no warnings).

- Patch UX: remove staged-files warning
  - Disabled the staged-overlap warning (no-op helper). Warning added noise and
    did not materially improve outcomes.

- CLI: new stan run semantics (default scripts+archive) + flags
  - Added -p/--plan to print run plan and exit 0 (no side effects).
  - Added -S/--no-scripts (opt out of scripts) with conflicts vs -s/-x.
  - Added -A/--no-archive (opt out of archives); -a overrides -A when both present.
  - Explicit conflict: -c with -A (runtime check).
  - Defaults: no flags → run all scripts, write archives.
  - Tests: semantics, plan-only path, conflicts; stabilized error codes.

- Patch UX: status banners + compact summary
  - Introduced a tiny status helper (TTY vs BORING):
    • success: ✔ / [OK], failure: ✖ / [FAIL], partial: △ / [PARTIAL].
  - service.ts prints status lines and a compact summary on failure.

- Patch service thin‑out (SRP; orchestrator only)
  - src/stan/patch/service.ts is a lean orchestrator; helpers handle the details.

- Docs: Simplified loop diagram & path update

- Open target files on patch failure

- FEEDBACK clipboard (test guard)

- Project prompt: document patch editor‑open behavior

Open (low priority)

- Investigate rare patch failures on very long Markdown files (e.g., dev plan)
  - Track frequency; consider chunked updates or higher context margins later.

Next up (high value)

- TSDoc Phase 2: internal helpers and small utilities
  - Add concise TSDoc (or header rationale) for internal helpers where missing.
  - Keep comments brief and behavioral; avoid repeating type information.
  - Maintain zero‑warning policy for TSDoc lint/TypeDoc.

- README and CLI help polish
  - Confirm CLI examples align with new flags semantics.
  - Keep the new “API docs and TSDoc” section current as rules evolve.

- README trim
  - Move detail to docs/ pages (CLI semantics, patch guide).
  - Update README to link out and keep quick‑start focused. - Ensure links are stable in the published docs site.

Notes: Patch generation learnings (process)

- Prefer small, anchored hunks with a/ and b/ prefixes and ≥3 lines of context.
- Avoid relying on index headers; target working tree content.
- One file per diff block; repeat per file when multiple updates are needed.
- For large Markdown insertions, consider smaller appended blocks or fall back to Full Listing for wholesale rewrites.
