**_ Begin Patch
_** Add File: .stan/refactors/20250820-211500-split-snap-helpers.md
+# Refactor: split snap history capture and reuse runGit
+When: 2025-08-20T21:15:00Z
+Why: Reduce duplication and improve maintainability of the snap command; clear knip warning for an “unused” git helper.
+What changed:
+- src/stan/snap.ts:

- - Removed inline runGit; import from ./snap/git
- - Delegated history/archives capture and state trimming to new helper
    +- src/stan/snap/capture.ts: new helper that copies the current snapshot/archives into history and maintains diff/.snap.state.json with bounded retention
    +- src/stan/snap/shared.ts: added SnapEntry and SnapState types for reuse
    +Tests/Lint:
    +- Behavior unchanged; snap undo/redo/set/info and stash behavior remain the same
    +- Knip: snap/git.ts is now referenced (no longer reported unused)
    +Next:
    +- Optionally extract stash flow into a tiny helper under snap/ if we want even thinner snap.ts
- \*\*\* End Patch
