# Refactor: force include output dir in archive.tar with -c

When: 2025-08-19T21:45:00Z
Why: With `stan run -a -c`, archive.tar must include the output directory. Relying solely on prefiltered file lists can miss it under some environments.
What changed:

- src/stan/archive.ts: when `includeOutputDir` is true, add `<outputPath>` as an explicit tar entry and filter out `<outputPath>/.diff`, `<outputPath>/archive.tar`, and `<outputPath>/archive.diff.tar`. This guarantees inclusion of output artifacts.
- No behavior change for non-combine runs.
  Tests/Lint:
- Existing tests remain valid; behavior now matches CLI spec in stan.project.md.
  Next:
- If you want symmetric exclusions for regular archives (e.g., always omit `<outputPath>/.diff`), we can document/enforce that explicitly.
