# Refactor: fix require-await in parse.fs.test.ts
When: 2025-08-22T01:29:00Z (UTC)
Why: ESLint reported @typescript-eslint/require-await in src/stan/patch/parse.fs.test.ts (async function with no awaits).
What changed:
- Made chToTmp synchronous and removed the unnecessary await in afterEach.
- No behavioral change; tests remain deterministic.

Tests/Lint:
- Tests: unchanged and still passing.
- Lint: resolves the single require-await error.

Next:
- None.

