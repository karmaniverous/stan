# Refactor: fix TS2307 for istextorbinary + remove stray backup folder
When: 2025-08-22T00:00:00Z (UTC)
Why:
- TypeScript/TypeDoc/Build failed with TS2307 for `istextorbinary`.
- A duplicate `b/` backup folder introduced duplicate sources/tests outside `src/`, causing ESLint parse errors and test timeouts (global mock restoration broke tar mocks).
What changed:
- Added a minimal types shim: `src/types/istextorbinary.d.ts`.
- Removed `b/src/stan/classifier.ts` and `b/src/stan/classifier.test.ts`.
- Removed unused dependency `diff-match-patch` (knip).
Tests/Lint:
- Lint: parsing error from `b/src/...` resolved.
- Tests: tar mocks no longer get reset by duplicate tests; timeouts should be eliminated.
- Typecheck/Build/Docs: TS2307 resolved via the shim.
Next:
- If any CI environment still times out, re-run with `--logHeapUsage` and verify no additional stray duplicates exist; consider excluding future backup dirs in `.gitignore`.
