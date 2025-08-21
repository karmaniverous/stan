**_ Begin Patch
_** Add File: .stan/refactors/20250822-011500-run-index-and-rejects-path.md
+# Refactor: run index compliance + rejects destination fix
+When: 2025-08-22T01:15:00Z (UTC)
+Why:
+- Ensure the “run” module follows the folder index guideline and exports a stable API (fixes build/tests resolving `runSelected` and types).
+- Move patch rejects to the canonical workspace path `.stan/patch/rejects/<UTC-stamp>/...` instead of ad‑hoc locations.
+What changed:
+- Deleted src/stan/run.ts (file) that shadowed the folder index.
+- Kept public API at src/stan/run/index.ts; consumers import from `@/stan/run`.
+- Removed redundant `export type { … }` from src/stan/run/service.ts (types are available from `run/index` or `run/types`).
+- Escaped “>” in a TSDoc block in src/stan/run/exec.ts to satisfy lint.
+- Updated rejects mover to place files under `.stan/patch/rejects/<UTC-stamp>/...`.
+Tests/Lint:
+- Build/test resolve `runSelected` correctly again; types (`ExecutionMode`, `RunBehavior`, `Selection`) are exported from `@/stan/run`.
+- TSDoc warning on “>” removed for the updated block.
+Next:
+- Proceed with extracting `snap` and `init` services to further slim CLI adapters.
\*\*\* End Patch
