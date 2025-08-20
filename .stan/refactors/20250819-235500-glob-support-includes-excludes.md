# Refactor: glob support for includes/excludes

When: 2025-08-19T23:55:00Z
Why: Users expect patterns like **/.tsbuild/** and **/generated/** to be excluded; previous implementation only supported root prefixes.
What changed:

- src/stan/fs.ts: added picomatch-based glob matching; plain strings remain prefix matches
- package.json: added "picomatch" runtime dependency
- docs: updated stan.project.md and stan.project.template.md to describe glob behavior and precedence
- tests: new src/stan/fs.glob.test.ts covering excludes and includes globs
  Tests/Lint:
- Tests: new glob tests pass locally; existing tests unchanged
- Lint/Typecheck: clean
  Next:
- Optional: extend .gitignore reader to support globs in the future (currently prefix-only)
