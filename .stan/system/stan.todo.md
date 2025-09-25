# STAN Development Plan

When updated: 2025-09-25 (UTC)

Next up (priority order)

1. Patch extensions: File Ops (declarative pre‑ops) - Service (remaining; future):
   - Parser and plan builder with normalization and validation errors.
   - `--check`: simulate ops, print plan, no side effects.
   - Apply mode: execute pre‑ops in order; stop on first failure; then run existing patch pipeline; write `.stan/patch/.debug/ops.json`.
   - FEEDBACK: include failing op diagnostics when applicable. - Tests:
   - Unit: parser/normalization (paths with ./, trailing slashes; reject .. and absolute), verb arity, error messages.
   - Unit: mv/rm/rmdir/mkdirp behaviors (success/failure cases; parent creation; non‑empty rmdir).
   - Integration: end‑to‑end patch with File Ops + unified diffs (pre‑ops then patch); `--check` dry‑run; FEEDBACK on failure.
   - Windows parity: ensure path normalization avoids EBUSY; follow existing teardown hygiene (cwd reset, stdin pause, brief settle).

2. Quick archive-size win (temporary)
   - Exclude `docs-src/**` and `diagrams/**` in stan.config.yml (keep `.stan/system/**`, keep README.md).
   - Future task: move docs to a dedicated package; remove these excludes when done.

3. CI stability monitoring (Windows)
   - Continue watching for teardown flakiness; keep stdin pause + cwd reset + brief settle; adjust as needed.
   - Verify Windows cancellation hardening (runner drain up to 1s, stdin pause, 150ms settle) on local Windows and in CI; tune if needed.
4. Gen-system hygiene
   - Config discovery already reuses centralized helpers; periodically review to avoid drift if related code evolves.

Backlog (nice to have)

- Optional compression research (keep canonical artifacts as plain .tar).
- Additional doc cross‑checks to keep CLI help and site pages in sync.
- Patch extensions: Exec (gated; non‑shell)
  - Only if repeated need arises.
  - `--allow-exec` opt‑in; spawn without shell; timeouts; strict logging; FEEDBACK on failure.

Completed (recent)

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
