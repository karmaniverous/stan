# Refactor: stabilize Windows test teardown

When: 2025-08-19T22:32:40Z
Why: Intermittent EBUSY rmdir on Windows when removing temp directories after tests.
What changed:

- src/test/setup.ts: also chdir to tmpdir before each test
  Tests/Lint:
- Tests: expected to stop EBUSY flakes; no behavior changes
- Lint: clean
  Next:
- If any test still flaps, raise jest/vitest timeout for that suite
