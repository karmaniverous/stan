# Refactor: update stan.system.md on `stan init`

When: 2025-08-20T12:05:00Z
Why: Ensure every project has a current stan.system.md, but only update it when users run `stan init` (not automatically).
What changed:

- src/cli/stan/init.ts:
  - New copyDoc() helper.
  - stan.system.md: overwrite if missing or different.
  - stan.project.md: still copy only if missing (avoid clobbering user docs).
    Tests/Lint:
- Existing tests unaffected; behavior change is limited to init path.
  Next:
- Optionally document this in stan.project.md under “CLI (repo tool behavior)”.
