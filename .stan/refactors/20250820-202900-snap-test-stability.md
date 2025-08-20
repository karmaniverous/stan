# Refactor: stabilize snap CLI tests via cwd and timeout

When: 2025-08-20T20:29:00Z
Why: The snap test wrote stan.config.yml under a temp dir but never chdir()’d before invoking the CLI. The CLI resolves the repo from process.cwd(), so snapshot state could be written elsewhere, leading to ENOENT on dir/out/diff/.snap.state.json. Slow environments also needed a slightly longer wait.
What changed:

- src/stan/snap.test.ts:
  - beforeEach: process.chdir(dir) so CLI resolves config under the temp repo.
  - afterEach: chdir back to os.tmpdir() before rm(dir) to avoid Windows EBUSY.
  - Increased waitFor timeout to 1500 ms to reduce flakiness.

Tests/Lint:

- Tests: Fixes the failing snap history test.
- Lint: No new warnings.

Next:

- Optional: add a tiny “exists after parseAsync” assertion in test to catch any regressions early.
