# STAN Development Plan

When updated: 2025-09-24 (UTC)

Next up (priority order)

1. Staged imports (imports) — land minimal feature
   - Types + loader:
     - Add `imports?: Record<string, string | string[]>` to config types.
     - Parse/normalize: coerce string→string[], trim, drop empties; ignore non‑object values.
     - Unit tests for normalization.
   - Paths:
     - Add `<stanPath>/imports` to path helpers (no reserved exclusions).
   - Staging helper:
     - `prepareImports({ cwd, stanPath, map })`:
       - Sanitize labels (allow A–Z a–z 0–9 @ / _ -; replace others with “_”; forbid “..”).
       - Clean `<stanPath>/imports/<label>` recursively.
       - Resolve globs (fast‑glob) with absolute paths allowed; `../` permitted.
       - Compute each file tail relative to glob parent (glob‑parent); copy to `<stanPath>/imports/<label>/<tail>`.
       - Log: `stan: import <label> -> N file(s)`.
       - Best‑effort skip unreadable files; do not fail run unless workspace IO throws.
   - Wire into archive phase:
     - Before createArchive/createArchiveDiff, compute normalized imports map (or `{}` if missing).
     - Call `prepareImports`.
     - Leave classifier, reserved exclusions, and keep semantics unchanged (imports always rebuilt).
   - Tests:
     - Unit: parsing/sanitization/mapping examples.
     - Integration: archives include `<stanPath>/imports/...` when archive=true; staging skipped in plan‑only and snap.
   - Deps: add `fast-glob` and `glob-parent` (runtime), usage local to helper.

2. Quick archive-size win (temporary)
   - Exclude `docs-src/**` and `diagrams/**` in stan.config.yml (keep `.stan/system/**`, keep README.md).
   - Future task: move docs to a dedicated package; remove these excludes when done.

3. CI stability monitoring (Windows)
   - Continue watching for teardown flakiness; keep stdin pause + cwd reset + brief settle; adjust as needed.

4. Gen‑system hygiene
   - Config discovery already reuses centralized helpers; periodically review to avoid drift if related code evolves.

Backlog (nice to have)

- Optional compression research (keep canonical artifacts as plain .tar).
- Additional doc cross‑checks to keep CLI help and site pages in sync.

Completed (recent)

- Patch rules “above the fold” wrapper guardrails
  - Added quick patch rules with canonical examples near the top of the system prompt; forbids legacy wrappers (“**_ Begin Patch”, “_** Add File:”, “Index:”).
  - Ingestion unwraps "\*\*\* Begin/End Patch" envelopes when a valid diff is present.
  - Validator reports explicit “no diff --git” and rejects forbidden wrappers.
  - Response Format/Policy updated: exactly one diff header per Patch, /dev/null for create/delete.
- Handoff spec trimmed
  - The cross‑thread handoff now contains only Project signature, Reasoning (short bullets), and Unpersisted tasks (short bullets). Startup/checklists are removed to rely on the fresh system prompt and archive in the new thread.
- Temporary docs exclusion to reduce archive size
  - Added `docs-src/**` and `diagrams/**` to config excludes; follow‑up task captures migration to a dedicated docs package prior to removing these excludes.
