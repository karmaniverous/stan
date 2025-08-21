**_ Begin Patch
_** Add File: .stan/refactors/20250822-010000-run-module-index-compliance.md
+# Refactor: run module index compliance
+When: 2025-08-22T01:00:00Z (UTC)
+Why: Conform to the system guideline “Prefer directory modules with an explicit public entry”. Avoid a `run.ts` file paired with a `run/` folder of helpers; expose the public API from `run/index.ts`.
+What changed:
+- Deleted src/stan/run.ts (file entry).
+- Added src/stan/run/index.ts exporting `runSelected` and types from the split services.
+- Kept existing imports working (consumers import from '@/stan/run').
+Tests/Lint:
+- No import path changes needed; CLI runner and unit tests continue to pass.
+Next:
+- Proceed with service extraction for `snap` and `init` to keep CLI adapters thin.
\*\*\* End Patch
