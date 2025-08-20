# Refactor: diff always-on + snapshot policy + snap cmd

When: 2025-08-19T14:45:00Z
Why: Avoid brittle diffs by decoupling snapshot updates from normal runs. Always create diff artifacts; snapshot only on first-run or explicit user command.
What changed:

- src/stan/diff.ts: add SnapshotUpdateMode; createArchiveDiff always writes diff; update snapshot only per mode; added writeArchiveSnapshot().
- src/stan/run.ts: always call createArchiveDiff with updateSnapshot='createIfMissing'.
- src/cli/stan/snap.ts: new `stan snap` subcommand to create/replace snapshot.
- src/cli/stan/index.ts: register `snap`.
- src/stan/diff.test.ts: tests assert presence of diff without relying on internals.
  Tests/Lint:
- Tests: pass (19/19).
- Lint/Typecheck: clean.
  Next:
- Optionally update README/stan.project.md to reflect new diff/snapshot behavior.
