# Refactor: split patch CLI helpers; fix snap import order

When: 2025-08-21T00:15:00Z
Why: Reduce file length and improve maintainability by extracting patch helpers (clean/apply/rejects/context). Clean up snap.ts imports to satisfy simple-import-sort and retain local-time presentation for `snap info`.

What changed:

- src/stan/patch/clean.ts: new — unified diff cleaning/extraction.
- src/stan/patch/apply.ts: new — git apply attempts and runner.
- src/stan/patch/rejects.ts: new — discover and relocate .rej files to `<stanPath>/refactors/patch-rejects-<UTC>/`.
- src/stan/patch/context.ts: new — resolve cwd and canonical patch paths.
- src/stan/patch.ts: slim adapter that composes the extracted helpers.
- src/stan/snap.ts: import order fixed; info prints local timestamps via formatUtcStampLocal.

Tests/Lint:

- Lint: snap.ts import order passes `simple-import-sort/imports`.
- Behavior: unchanged for patch and snap commands (aside from improved info formatting already implemented).

Next:

- Consider extracting stash/archives capture logic from snap.ts into `src/stan/snap/git.ts` and `src/stan/snap/capture.ts` for further modularity.
