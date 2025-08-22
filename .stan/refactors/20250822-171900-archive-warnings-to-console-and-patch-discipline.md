diff --git a/.stan/refactors/20250822-171900-archive-warnings-to-console-and-patch-discipline.md b/.stan/refactors/20250822-171900-archive-warnings-to-console-and-patch-discipline.md
new file mode 100644
--- /dev/null
+++ b/.stan/refactors/20250822-171900-archive-warnings-to-console-and-patch-discipline.md
@@ -0,0 +1,18 @@
+# Refactor: archive warnings to console + patch discipline
+When: 2025-08-22T17:19:00Z (UTC)
+Why: New requirement — do not write archive warnings to a text file; log them to the console instead. Also fix invalid hunk formatting in assistant‑generated patches (jsdiff parse error).
+What changed:
+- README.md: replaced references to `archive.warnings.txt` with console logging.
+- src/stan/archive.ts: removed file write/inclusion of `archive.warnings.txt`; log warningsBody to console when present.
+- src/stan/archive.classifier.behavior.test.ts: removed warnings-file assertion.
+- stan.project.md: documented console‑only warnings.
+- stan.todo.md: added P0 items for patch hunk discipline and warnings UX.
+Tests/Lint:
+- Tests updated; behavior verified with existing tar mocks.
+- Lint/Typecheck unchanged.
+Next:
+- Consider excluding other STAN-internal logs from archives by default if they grow in volume (keep repo history, but trim archives).
