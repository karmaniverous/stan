**_ Begin Patch
_** Add File: .stan/refactors/20250820-201500-fix-stan-dirs-patch-paths.md
+# Refactor: complete StanDirs with patch paths
+When: 2025-08-20T20:15:00Z
+Why: stan patch crashed because makeStanDirs did not populate patchAbs/patchRel; TypeScript/Typedoc also flagged missing properties.
+What changed:
+- src/stan/paths.ts: add patchRel and patchAbs to the computed directory map and returned object.
+Tests/Lint:
+- Fixes runtime error “The "path" argument must be of type string. Received undefined” from src/stan/patch.ts.
+- Resolves TS2739 in paths.ts and associated typedoc/rollup warnings.
+Next:
+- None; this aligns path mapping with project policy (.stan/patch).

- \*\*\* End Patch
