# Refactor: jsdiff compatibility with "diff" v8 + test mock path fix
When: 2025-08-21T23:18:00Z (UTC)
Why: Type errors and a test timeout stemmed from a breaking change in the "diff" library API (no ParsedDiff; compareLine signature changed) and an incorrect mock path that caused real git to run.
What changed:
- src/stan/patch/jsdiff.ts:
  - Switched to StructuredPatch and updated compareLine(lineNumber, line, operation, patchContent) to be whitespace/CR tolerant.
  - Removed unnecessary regex escape; eliminated unsafe-argument cast.
- src/stan/patch/patch.jsdiff.test.ts:
  - Corrected vi.mock path to '@/stan/patch/apply'; removed async without await (require-await).
- src/stan/patch/index.ts:
  - Import ordering and Prettier format only (no behavior change).
Tests/Lint:
- typecheck: expected to pass for jsdiff.ts
- docs: typedoc errors resolved (same root cause)
- tests: jsdiff fallback test no longer times out
- lint: fixes for require-await and no-useless-escape; remaining polish left for a follow-up (import sort/Prettier elsewhere already addressed here)
Next:
- Follow-up to remove an unused eslint-disable in src/stan/version.ts and consider minor TSDoc '>' escape warnings.
