# Refactor: patch diagnostics + rejects mover rename
When: 2025-08-22T14:25:00Z (UTC)
Why: Improve failed-patch UX: explicit diagnostics file path, copy FEEDBACK to clipboard, and place *.rej under the patch workspace. Remove legacy mover name to avoid future tangles.
What changed:
- src/stan/patch/index.ts:
  - Log explicit path to `.stan/patch/.debug/attempts.json`
  - Always write `.stan/patch/.debug/feedback.txt` and copy to clipboard; log that exact path
  - Use new mover function for rejects
- src/stan/patch/rejects.ts:
  - Rename `moveRejFilesToRefactors` -> `moveRejFilesToPatchWorkspace`
  - Destination: `<stanPath>/patch/rejects-<UTC>/...`
- .stan/system/stan.system.md:
  - Make refactor notes MANDATORY for any code change
Tests/Lint:
- Tests unaffected (adapter-level change); typecheck/lint expected clean
Next:
- Consider emitting a short summary line with the count of reject files per file in FEEDBACK (optional).
