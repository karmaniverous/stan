# Refactor: patch reporter polish + jsdiff test lint fix
When: 2025-08-22T00:07:00Z (UTC)
Why: Improve failure diagnostics and artifacts for the `stan patch` pipeline, and clear remaining Prettier lint in the jsdiff fallback test.
What changed:
- src/stan/patch/index.ts:
  - attempts.json now includes both `git` attempt captures and `jsdiff` results (okFiles, failedFiles, sandboxRoot).
  - On total failure (non-debug), prints a short snippet from the last git-apply stderr to aid quick triage.
  - After `--check` runs, prunes older sandboxes in `<stanPath>/patch/.sandbox/` (retains latest 5).
- src/stan/patch/patch.jsdiff.test.ts:
  - Suppress Prettier formatting to avoid CRLF-vs-LF churn in CI for this test file.
Tests/Lint:
- tests: 32/32 passing
- typecheck/docs: clean
- lint: Prettier errors cleared; only informational TSDoc warnings remain elsewhere
Next:
- P0: consider adding a concise stderr summary of the last failing attempt to FEEDBACK (envelope), and optionally bound `.sandbox` retention by size/time.
- P1: wire `preflightDocsAndVersion` at run start and add tests.
