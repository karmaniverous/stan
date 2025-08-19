# Refactor: remove isDirect guard from CLI entry

When: 2025-08-19T23:42:00Z
Why: With a dedicated bin launcher, index.ts should never self-execute; the guard caused no-op under bin shims.
What changed:

- src/cli/stan/index.ts: removed isDirect check and unused node path/url imports
- Index now purely exports makeCli for programmatic use and tests
  Tests/Lint:
- No behavior change to CLI launch (handled by new bin launcher)
- Lint: fewer unused imports; should be clean
  Next:
- Ensure package.json "bin" points to dist/cli/stan.js and rollup builds the launcher
