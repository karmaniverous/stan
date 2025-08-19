# Refactor: combine diff filter + tests

When: 2025-08-19T21:00:00Z
Why: In `-a -c` mode, archive.diff.tar included the output dir with the newly created archive files inside it, which is undesirable. We also want a test that exercises archiving behavior against a temp dir.
What changed:

- src/stan/diff.ts: exclude `<outputPath>/archive.tar` and `<outputPath>/archive.diff.tar` from the diff when `includeOutputDirInDiff` is true; keep excluding `<outputPath>/.diff`.
- src/stan/diff.combine.behavior.test.ts: new tests that construct a temp directory and assert both the diff filter semantics and regular-archive inclusion of outputs via a tar mock.
  Tests/Lint:
- New tests pass locally in isolation with mocked tar; no lint impacts expected.
  Next:
- Optional: also exclude `<outputPath>/.diff` in regular archive (`-a -c`) if you prefer to keep snapshots out of the full archive.
