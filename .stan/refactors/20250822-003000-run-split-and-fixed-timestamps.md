**_ Begin Patch
_** Add File: .stan/refactors/20250822-003000-run-split-and-fixed-timestamps.md
+# Refactor: split run into services + fixed-width timestamps
+When: 2025-08-22T00:30:00Z (UTC)
+Why: Enforce SRP at module level and keep CLI adapters thin; make timestamp display deterministic with leading zeros for consistent width.
+What changed:
+- src/stan/run.ts: replaced in-file implementation with a thin facade that re-exports the run service and types.
+- Added src/stan/run/types.ts (shared types), src/stan/run/plan.ts (pure plan rendering), src/stan/run/exec.ts (selection + spawn logic), src/stan/run/archive.ts (archive phase + cleanups), src/stan/run/service.ts (orchestrator).
+- src/stan/util/time.ts: formatUtcStampLocal now emits fixed-width `YYYY-MM-DD HH:MM:SS`.
+Tests/Lint:
+- No import path changes for callers; runSelected remains exported from '@/stan/run'.
+- Existing tests pass; plan output and archiving behavior unchanged.
+Next:
+- Phase 2: extract snap service; keep CLI thin.
+- Phase 3: extract init service; keep CLI thin.
\*\*\* End Patch
