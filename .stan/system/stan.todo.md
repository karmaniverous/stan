# STAN Development Plan

When updated: 2025-09-25 (UTC)

Next up (priority order)

1. After repo decomposition: staged patch strategy (DMP → git → listing) + FEEDBACK v2 (lean)
   - Implement DMP ingestion/apply engine:
     - Recognize DMP Patch blocks (sentinel), normalize LF internally, preserve original EOL on write.
     - Conservative fuzz; clear failure when drift exceeds tolerance.
   - Validator:
     - Accept either unified diff or DMP in “### Patch: …” (one patch per file hard rule remains).
   - FEEDBACK v2:
     - Minimal per‑file entries: { path, engine, class, snippet? }; keep rich logs under .debug/.
   - Docs:
     - Project prompt (this file) + short system prompt cross‑reference on the ladder and “one version per file per turn”.
   - Tests:
     - Unit: DMP parse/apply (insert/replace/delete; boundaries; EOL; failure classes).
     - Integration: File Ops + DMP; FEEDBACK v2; DMP→git transition; listings on success.
   - Acceptance:
     - `stan patch` cleanly applies DMP or unified diff; FEEDBACK lists only failed files with accurate engine/class; assistant can deterministically advance ladder stages from artifacts alone.

1. Patch extensions: File Ops (declarative pre‑ops) - Service (remaining; future): - Parser and plan builder with normalization and validation errors.
   - `--check`: simulate ops, print plan, no side effects.
   - Apply mode: execute pre‑ops in order; stop on first failure; then run existing patch pipeline; write `.stan/patch/.debug/ops.json`.
   - FEEDBACK: include failing op diagnostics when applicable. - Tests:
   - Unit: parser/normalization (paths with ./, trailing slashes; reject .. and absolute), verb arity, error messages.
   - Unit: mv/rm/rmdir/mkdirp behaviors (success/failure cases; parent creation; non‑empty rmdir).
   - Integration: end‑to‑end patch with File Ops + unified diffs (pre‑ops then patch); `--check` dry‑run; FEEDBACK on failure.
   - Windows parity: ensure path normalization avoids EBUSY; follow existing teardown hygiene (cwd reset, stdin pause, brief settle).
1. CI stability monitoring (Windows)
   - Continue watching for teardown flakiness; keep stdin pause + cwd reset + brief settle; adjust as needed.
   - Verify Windows cancellation hardening (runner drain up to 1s, stdin pause, 150ms–800ms settle) on local Windows and in CI; tune if needed.
1. Gen-system hygiene
   - Config discovery already reuses centralized helpers; periodically review to avoid drift if related code evolves.

3) CI stability monitoring (Windows)
   - Continue watching for teardown flakiness; keep stdin pause + cwd reset + brief settle; adjust as needed.
   - Verify Windows cancellation hardening (runner drain up to 1s, stdin pause, 150ms settle) on local Windows and in CI; tune if needed.
4) Gen-system hygiene
   - Config discovery already reuses centralized helpers; periodically review to avoid drift if related code evolves.

Backlog (nice to have)

- Optional compression research (keep canonical artifacts as plain .tar).
- Additional doc cross‑checks to keep CLI help and site pages in sync.
- Patch extensions: Exec (gated; non‑shell)
  - Only if repeated need arises.
  - `--allow-exec` opt‑in; spawn without shell; timeouts; strict logging; FEEDBACK on failure.

Completed (recent)

- Lint/typecheck: fix patch module hygiene
  - Add missing mkdir import in src/stan/patch/file-ops.ts to resolve TS2304 and Typedoc error.
  - Replace any[] cast with FileOp[] in src/stan/patch/file-ops.test.ts to satisfy ESLint no-unsafe-argument/no-explicit-any.
- File Ops: recursive directory operations
  - Enable full‑tree moves and deletes across multiple targets in one patch:
    - mv now supports moving files or directories recursively (no overwrite).
    - rm now removes files or directories recursively.
    - rmdir retained for explicit empty‑dir deletes; mkdirp uses ensureDir.
  - Runtime uses fs‑extra; project/system docs updated to clarify that File Ops are structural (directory/file moves/creates/deletes) and are distinct from unified‑diff content edits.

- Windows cancellation settle (SIGINT path)
  - Increase the final settle after cancellation from 800ms to 1200ms to further reduce transient EBUSY/ENOTEMPTY during temp-dir teardown in cancel.sigint tests.
- System prompt: list-numbering policy
  - Add system-level guidance to avoid numbering primary (top‑level) items in requirements and TODO documents; use unordered lists to reduce renumbering churn.

- Decompose run/service.ts (orchestration → session)
  - Created src/stan/run/session.ts to encapsulate one run attempt (UI, cancellation, script execution, archive phase) and support live restart without duplicating logic. - Slimmed src/stan/run/service.ts to plan/prepare and delegate to session; preserved all logs and test-observed behavior (plan printing, live/no‑live parity, archive suppression on cancel).
- Quick archive-size win (temporary)
  - Excludes already in place in stan.config.yml:
    - `docs-src/**` and `diagrams/**` (while keeping `.stan/system/**` and README.md). - Follow-up: when docs are split to a dedicated package, remove these excludes.

- Staged imports (imports) — minimal feature
  - Added imports?: Record<label, string | string[]> to config and normalization.
  - Implemented prepareImports to stage matched files under <stanPath>/imports/<label>/..., mapping tails via glob-parent.
  - Wired staging into archive phase (runs only when archives are written).
  - Logging: "stan: import <label> -> N file(s)" per label.
  - Tests: added unit test for staging behavior and logging; basic inclusion via existing archive flow.
- Fix: File Ops validator absolute-path detection in response validator
  - normSafe now checks the raw POSIX path for absoluteness before normalization to ensure inputs like "/etc/passwd" are correctly rejected as invalid repo‑relative paths.

- Windows cancellation EBUSY mitigation (tuning)
  - Increased bounded wait for script drain on cancel from 1.0s to 1.5s and the final settle from 150ms to 400ms to further reduce transient EBUSY during temp‑dir teardown in tests.
