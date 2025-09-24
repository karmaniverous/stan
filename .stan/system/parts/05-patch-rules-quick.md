# Patch rules & canonical examples (quick)

Use plain unified diffs with git‑style headers. One Patch block per file.

Key rules
- Exactly one header per Patch block:
  - `diff --git a/<path> b/<path>`
  - `--- a/<path>` and `+++ b/<path>`
  - At least 3 lines of context per hunk (`@@ -oldStart,oldLines +newStart,newLines @@`)
- Paths: POSIX separators; repo‑relative; prefer `a/` and `b/` prefixes (STAN tries `-p1` then `-p0`).
- Line endings: normalize to LF in the patch.
- Create/delete:
  - New file: `--- /dev/null` and `+++ b/<path>`
  - Delete:   `--- a/<path>` and `+++ /dev/null`
- Forbidden wrappers (not valid diffs): `*** Begin Patch`, `*** Add File:`, `Index:` or mbox/email prelude lines. Do not use them.

Canonical examples

Modify existing file:
```diff
diff --git a/src/example.ts b/src/example.ts
--- a/src/example.ts
+++ b/src/example.ts
@@ -1,4 +1,4 @@
-export const x = 1;
+export const x = 2;
 export function y() {
   return x;
 }
```

New file:
```diff
diff --git a/src/newfile.ts b/src/newfile.ts
--- /dev/null
+++ b/src/newfile.ts
@@ -0,0 +1,4 @@
+/** src/newfile.ts */
+export const created = true;
+export function fn() { return created; }
+
```

Delete file:
```diff
diff --git a/src/oldfile.ts b/src/oldfile.ts
--- a/src/oldfile.ts
+++ /dev/null
@@ -1,4 +0,0 @@
-export const old = true;
-export function gone() {
-  return old;
-}
```

Pre‑send checks (quick)
- Every Patch block contains exactly one `diff --git a/<path> b/<path>`.
- No forbidden wrappers appear in any Patch block.
- Create/delete patches use `/dev/null` headers as shown above.
