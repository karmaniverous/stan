# Refactor: exclude combined tar from itself

When: 2025-08-19T23:59:00Z
Why: In combine+archive mode, combined.tar included stan/combined.tar (self-inclusion), producing an incorrect archive and confusion about stale outputs.
What changed:

- src/stan/run.ts: add filter to tar.create that excludes <outputPath>/<combinedName>.tar (and keep excluding <outputPath>/.diff). This prevents self-inclusion.
  Tests/Lint:
- Existing tests remain green; behavior matches project requirement “ONLY combined.tar (includes output dir)”.
- Lint/Typecheck: no new issues.
  Next:
- Consider updating package.json “stan:build” to redirect Rollup logs to a different file (e.g., stan/rollup.txt) or let STAN capture stdout/stderr without redirection to avoid Windows file-handle collisions.
