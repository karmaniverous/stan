# Refactor: jsdiff fallback + sandbox for --check
When: 2025-08-21T22:45:00Z (UTC)
Why: Make patches “just work” by adding a whitespace/EOL-tolerant fallback engine and deterministic path resolution. Support --check by writing to <stanPath>/patch/.sandbox/<ts>/ without touching repo files.
What changed:
- src/stan/patch/jsdiff.ts: new engine using “diff” (parsePatch/applyPatch), whitespace/EOL tolerant; preserves original EOL; deterministic path mapping; sandbox support.
- src/stan/patch.ts: integrated jsdiff fallback after git apply; added FEEDBACK envelope details for jsdiff; removed const assertion; replaced require() with JSON read; added utcStamp for sandbox path; new logging.
- package.json: added diff runtime dependency.
- tests: added src/stan/patch.jsdiff.test.ts (mocks git apply to fail; verifies jsdiff success and CRLF preservation).
Tests/Lint:
- Tests: pass in local runs; jsdiff path covered by new test.
- Lint: no-require-imports resolved; Prettier normalized LF.
Next:
- Extend pipeline reporter to include jsdiff stats in attempts.json; consider adding partial-success envelope status “partial” handling in UI outputs.

