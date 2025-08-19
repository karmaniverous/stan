# Refactor: clear lint error & tsdoc warning

When: 2025-08-19T23:15:00Z
Why: Lint reported one unused var in init.ts and a tsdoc escape warning in cli-utils.ts.
What changed:

- src/cli/stan/init.ts: removed unused isStringArray
- src/cli/stan/cli-utils.ts: escaped ">" in doc arrows
  Tests/Lint:
- Lint: expected clean after change
- Tests: no behavior change
  Next:
- Consider extracting shared minor type guards into a small util if needed later
