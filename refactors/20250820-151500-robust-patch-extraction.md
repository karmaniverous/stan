# Refactor: robust patch extraction

When: 2025-08-20T15:15:00Z
Why: Diagnostics showed “patch with only garbage at line 5” because the patch file included headings and multiple code fences; we only stripped outer wrappers. We must extract the actual diff from within surrounding prose.
What changed:

- src/stan/patch.ts: added looksLikeUnifiedDiff(), extractFencedUnifiedDiff(), extractRawUnifiedDiff(); detectAndCleanPatch now extracts the first valid diff and strips trailing fences; ensured final newline.
- Kept --recount and tolerant apply strategies across -p1/-p0 with 3way/ignore/reject.
  Tests/Lint:
- Existing tests unaffected (spawn is mocked); no new lint issues expected.
  Next:
- If desired, surface a concise stderr summary of the last failing attempt in non-debug mode.
