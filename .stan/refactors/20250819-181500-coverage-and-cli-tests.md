# Refactor: coverage scoping + missing CLI tests

When: 2025-08-19T18:15:00Z
Why: Limit coverage to only src files and increase coverage by adding missing tests for CLI help and patch subcommand.
What changed:

- vitest.config.ts: coverage.include src/\*_/_.ts; exclude tests/setup/d.ts
- src/cli/stan/index.help.test.ts: asserts help footer integration and subcommand registration
- src/stan/patch.test.ts: asserts path normalization and git apply invocation for `stan patch`
  Tests/Lint:
- Tests: expected to pass; no behavioral changes to runtime code
- Lint: clean
  Next:
- Optional: add tests for `stan snap` action by mocking dynamic imports to assert snapshot write call
