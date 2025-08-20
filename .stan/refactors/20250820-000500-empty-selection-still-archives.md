# Refactor: run -a with empty selection still archives

When: 2025-08-20T00:05:00Z
Why: With `-e` excluding all keys, selection becomes empty; `stan run -a` should still write archives. Previously we returned before the archive phase.
What changed:

- src/stan/run.ts: removed early return on empty selection; skip script runs but proceed with archive phase when `--archive` is set.
- Also keeps debug streaming behavior and plan output intact.
  Tests/Lint:
- Existing tests should remain green; consider adding a test for “except all” generating archives.
  Next:
- Optional: add an E2E test that `-a -e <all>` produces archive.tar + archive.diff.tar and suppresses help footer.
