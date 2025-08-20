# Refactor: complete stanPath test migration

When: 2025-08-20T18:00:00Z
Why: The codebase switched from outputPath to stanPath with a new layout (stan/system, stan/output, stan/diff). Tests and a few call sites still referenced outputPath and old paths, causing type errors and runtime failures.
What changed:

- Tests: updated all ContextConfig stubs to use `stanPath` and adjusted path assertions to `<stanPath>/output/...`.
- fs.glob/diff tests: updated FilterOptions and createArchiveDiff calls to pass `stanPath`.
- Plan header test: now expects `output: stan/output/`.
- ESLint: ignored `stan/dist/**` to avoid lint noise from dev CLI builds under the new layout.
  Tests/Lint:
- Expect typecheck errors related to outputPath to be resolved.
- Unit tests should no longer crash on `.replace` due to missing `stanPath`.
  Links:
- See stan/output/typecheck.txt, test.txt from prior run for original failures.
  Next:
- Tackle patch application robustness (3‑way gating and full‑listing preference) as discussed previously.
