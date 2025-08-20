# Refactor: increase Vitest timeouts for Windows stability

When: 2025-08-19T23:17:00Z
Why: Intermittent timeouts (>5s) and EBUSY teardown on Windows in sequential runs.
What changed:

- vitest.config.ts: testTimeout=15000, hookTimeout=10000
  Tests/Lint:
- Tests: expected to stabilize suites that occasionally exceed default 5s
- Lint/Typecheck: unaffected
  Next:
- If rare EBUSY persists, consider adding retry to rm in specific tests or serializing tar mocks
