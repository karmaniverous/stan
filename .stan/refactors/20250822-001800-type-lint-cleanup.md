# Refactor: typecheck/docs and lint cleanup

When: 2025-08-22T00:18:00Z
Why: The build/docs/typecheck steps failed due to TS errors in preflight.run.test.ts, and ESLint flagged an empty catch block in run.ts.

What changed:
- src/stan/preflight.run.test.ts: use vi.fn<(cwd: string) => Promise<void>> and a typed mock signature (cwd: string) => preflightSpy(cwd).
- src/stan/run.ts: keep preflight best‑effort but log a debug‑only message in the catch block to satisfy no-empty.

Tests/Lint:
- Tests: unchanged and still passing.
- Typecheck/docs: expected to pass after typing fixes.
- Lint: no-empty resolved without changing runtime behavior (only logs under STAN_DEBUG=1).

Next:
- Proceed with remaining P0 items (parse/resolver, FEEDBACK envelope polish).
