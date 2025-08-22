diff --git a/.stan/refactors/20250822-180900-harden-archive-excludes.md b/.stan/refactors/20250822-180900-harden-archive-excludes.md
new file mode 100644
index 0000000..c0ffee1
--- /dev/null
+++ b/.stan/refactors/20250822-180900-harden-archive-excludes.md
@@ -0,0 +1,14 @@
+# Refactor: harden archive excludes (refactors/diff) in non-combine mode
+When: 2025-08-22T18:09:00Z (UTC)
+Why: `stan run -a` could include `.stan/refactors/**` if pre-filtering ever passed those paths through. We already enforce excludes in combine mode via a tar filter; this change adds the same tar-level guard to the non-combine path for defense-in-depth.

- +What changed:
  +- src/stan/archive.ts: in the non-combine branch, tar.create now uses a `filter` that excludes:
- - `<stanPath>/refactors/**`
- - `<stanPath>/diff/**`
- - `<stanPath>/output/archive*.tar` and `<stanPath>/output/archive.warnings.txt` (safety).
- +Tests/Lint:
  +- Behavior: `.stan/refactors/**` is now guaranteed to be excluded in all archive modes.
  +- Lint/Typecheck: unchanged.
- +Next:
  +- None.
