# STAN Development Plan

When updated: 2025-09-24 (UTC)

Next up (priority order)

1. Patch extensions: File Ops (declarative pre‑ops) - Requirements integration (done in project prompt).
   - Parser & service (landed this turn):
     - Parse fenced "### File Ops" block; safe executor with dry‑run/apply; ops.json logging; integrated before patching.
   - Validator (next):
     - Parse optional “### File Ops” block; enforce allowed verbs (mv|rm|rmdir|mkdirp), path arity, and repo‑relative POSIX paths.
     - Reject absolute paths and any normalized traversal outside repo root.
   - Service (remaining):
     - Parser and plan builder with normalization and validation errors.
     - `--check`: simulate ops, print plan, no side effects.
     - Apply mode: execute pre‑ops in order; stop on first failure; then run existing patch pipeline; write `.stan/patch/.debug/ops.json`.
     - FEEDBACK: include failing op diagnostics when applicable.   - Tests:
     - Unit: parser/normalization (paths with ./, trailing slashes; reject .. and absolute), verb arity, error messages.
     - Unit: mv/rm/rmdir/mkdirp behaviors (success/failure cases; parent creation; non‑empty rmdir).
     - Integration: end‑to‑end patch with File Ops + unified diffs (pre‑ops then patch); `--check` dry‑run; FEEDBACK on failure.
     - Windows parity: ensure path normalization avoids EBUSY; follow existing teardown hygiene (cwd reset, stdin pause, brief settle).
   - Docs: add concise “File Ops block (pre‑ops)” guidance to Response Format (only after implementation) with 2–3 examples.

2. Staged imports (imports) — land minimal feature
   - Types + loader:
     - Add `imports?: Record<string, string | string[]>` to config types.
     - Parse/normalize: coerce string→string[], trim, drop empties; ignore non‑object values.
     - Unit tests for normalization.
   - Paths:
     - Add `<stanPath>/imports` to path helpers (no reserved exclusions). - Staging helper:
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

3. Quick archive-size win (temporary)
   - Exclude `docs-src/**` and `diagrams/**` in stan.config.yml (keep `.stan/system/**`, keep README.md).
   - Future task: move docs to a dedicated package; remove these excludes when done.

4. CI stability monitoring (Windows)
   - Continue watching for teardown flakiness; keep stdin pause + cwd reset + brief settle; adjust as needed.
   - Verify Windows cancellation hardening (runner drain up to 1s, stdin pause, 150ms settle) on local Windows and in CI; tune if needed.
5. Gen‑system hygiene
   - Config discovery already reuses centralized helpers; periodically review to avoid drift if related code evolves.

Backlog (nice to have)

- Optional compression research (keep canonical artifacts as plain .tar).
- Additional doc cross‑checks to keep CLI help and site pages in sync.
- Patch extensions: Exec (gated; non‑shell)
  - Only if repeated need arises.
  - `--allow-exec` opt‑in; spawn without shell; timeouts; strict logging; FEEDBACK on failure.

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
- Windows cancellation EBUSY mitigation
  - Implemented longer bounded wait for script drain (up to 1000 ms), proactive stdin.pause(), and a 150 ms settle in the cancellation path to reduce EBUSY during temp-dir teardown on Windows.
