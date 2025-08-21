# Refactor: resolver FS-backed diagnostics

When: 2025-08-22T02:15:00Z (UTC)
Why: Improve FEEDBACK quality by checking whether target files exist under the repo and annotating diagnostics accordingly (path not found, exists yes/no). This helps distinguish path issues from context drift without fuzzy matching.

What changed:
- src/stan/patch/parse.ts: added diagnosePatchWithFs(cwd, info); removed unused StructuredPatch type import (lint).
- src/stan/patch/index.ts: use diagnosePatchWithFs for FEEDBACK diagnostics (top 10 files).
- src/stan/patch/parse.fs.test.ts: tests for presence/absence diagnostics.

Tests/Lint:
- Lint/typecheck/docs pass.
- Tests pass locally; new parser FS test added.

Next:
- Optional DMP fallback engine (deferred).
- Potential resolver extension: try alternative path roots or include config-driven remaps if needed.
