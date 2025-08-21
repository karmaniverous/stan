# Refactor: separate patch CLI (Commander) from service API
When: 2025-08-22T16:05:00Z (UTC)
Why: Commander wiring should live under cli; src/stan/patch should expose an API. This shrinks a very large module and aligns with SRP and the TypeScript module index guideline.
What changed:
- Added src/stan/patch/service.ts with the patch execution logic used by the CLI.
- Added src/cli/stan/patch.ts (Commander adapter) that delegates to the service.
- Slimmed src/stan/patch/index.ts to export the API and re-export registerPatch for backward compatibility.
- Updated src/cli/stan/index.ts to import registerPatch from '@/cli/stan/patch'.
Tests/Lint:
- Tests continue to pass; existing tests importing registerPatch from '@/stan/patch' remain valid via re-export.
- Lint/typecheck/docs: unchanged; module responsibilities clearer.
Links:
- Artifacts: .stan/patch/.debug/attempts.json, .stan/patch/.debug/feedback.txt
Next:
- Consider extracting structured return objects from runPatch if/when we add a programmatic consumer beyond the CLI.
