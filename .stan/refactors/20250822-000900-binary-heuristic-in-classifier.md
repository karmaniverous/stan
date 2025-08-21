**_ Begin Patch
_** Add File: .stan/refactors/20250822-000900-binary-heuristic-in-classifier.md
+# Refactor: replace istextorbinary with fast NUL-byte heuristic
+When: 2025-08-22T00:09:00Z (UTC)
+Why: Tests that call createArchive/createArchiveDiff were timing out because the callback-based `istextorbinary` detector could hang in the test environment, stalling `classifyForArchive`. Replacing it with a simple first-few-KB NUL-byte check removes the dynamic import and eliminates the hang.
+What changed:
+- src/stan/classifier.ts: removed dynamic import + callback wrapper; added `isLikelyBinary()` that reads up to 8 KB and flags files containing 0x00. Kept size/LOC warnings intact.
+Tests/Lint:
+- Expect archive/classifier/diff tests to complete without 15s timeouts.
+- No API changes; unit tests asserting binary exclusion (files with NUL) continue to pass.
+Next:
+- If we ever need stricter detection, we can add a secondary heuristic (e.g., non-ASCII ratio) without reintroducing callback APIs.

- \*\*\* End Patch
