**_ Begin Patch
_** Add File: .stan/refactors/20250820-clipboardy-externalize.md
+# Refactor: externalize clipboardy to fix global clipboard reads
+When: 2025-08-20T00:00:00Z
+Why: `stan patch` failed in global installs because clipboardy's platform fallbacks were bundled and looked up under `dist/fallbacks/...`. Clipboardy expects to resolve binaries from its package at runtime.
+What changed:
+- rollup.config.ts: marked `clipboardy` (and its subpaths) as external so it loads from node_modules at runtime.
+Impact:
+- Local/dev runs unchanged. Global install now reads clipboard successfully.
+Tests/Lint:
+- No code paths changed; bundling only. Lint/typecheck unaffected.
+Next:
+- If other dependencies ship external assets, add them to `externalPkgs` similarly.

- \*\*\* End Patch
