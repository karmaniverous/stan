# Refactor: coverage scoping + simplified CLI tests

When: 2025-08-19T18:28:00Z
Why: Restrict coverage to src only and ensure stable, testable CLI behavior without relying on internal bindings or process exit flows.
What changed:

- vitest.config.ts: coverage include/exclude set to src only
- src/cli/stan/index.help.test.ts: use outputHelp(cb) to capture help without exiting; assert footer and subcommands
- src/stan/patch.test.ts: mock spawn safely and assert logged normalized patch path and success line
  Tests/Lint:
- Tests: expected to pass; avoids process.exit and real git calls
- Lint: no @ts-expect-error, no unsafe any calls
  Next:
- Optionally add a test for `snap` subcommand by mocking dynamic imports to assert snapshot write
