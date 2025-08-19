# Refactor: CLI enum recovery via parent tokens

When: 2025-08-19T12:55:00Z
Why: Explicit operands (e.g., `run lint test -s`, `run -c lint`) were not always captured via action param or command.args.
What changed:

- src/cli/stan/runner.ts: add `enumeratedFromParentTokens()` parsing parent args/rawArgs; skip `-e/--except` values; collect non-option operands; filter/dedupe to known keys.
- Keep prior action/args paths; lint remains clean.
  Tests/Lint:
- tests: remaining failures expected to pass.
- lint: no new warnings/errors.
  Next:
- None.
