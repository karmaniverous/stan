# Refactor: adopt TS module index guideline; move patch module to folder index
When: 2025-08-21T23:15:00Z (UTC)
Why: System-level TypeScript guideline: avoid `foo.ts` with helpers in `/foo`; use `foo/index.ts` as the module’s public API. Align the patch CLI module with the rule.
What changed:
- .stan/system/stan.system.md: added “TypeScript module layout (guideline)”.
- src/stan/patch/index.ts: new module entry (content migrated from patch.ts); relative imports updated to local helpers; util import corrected to ../util/time.
- src/stan/patch.ts: removed (replaced by folder index).
Tests/Lint:
- Tests: imports of `@/stan/patch` resolve to the folder index; existing tests should remain green.
- Lint/Typecheck: stable; no-require-imports remains resolved; tsdoc/format unaffected by this change.
Next:
- Continue P0 work (pipeline reporter stats for jsdiff; FEEDBACK envelope polish), then wire P1 preflight and P2 version metadata.
