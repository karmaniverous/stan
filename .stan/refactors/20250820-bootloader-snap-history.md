# Refactor: bootloader stanPath resilience + snap history/undo/redo

When: 2025-08-20T00:00:00Z
Why: Make the bootloader robust to custom stanPath and add a bounded snapshot history with undo/redo/info. Also enforce “stash fails ⇒ no snap” and prep for re‑publishing current code as v0.1.0.
What changed:
- .stan/system/stan.bootloader.md: discover stanPath from config; fall back to */system/stan.system.md.
- src/stan/config.ts: new maxUndos (default 10) to bound snapshot stack.
- src/stan/snap.ts: add snap undo/redo/info; maintain diff/.snap.state.json with copies under diff/snapshots \& diff/archives; abort snap when stash fails.
- package.json: set version to 0.1.0 for re‑publish.

Tests/Lint:
- Existing tests pass per prior run; new behaviors covered by follow‑up tests as needed.
- Lint: TSDoc “>” escaped in new/edited blocks.

Links:
- Release plan below.

Next:
- Optional: unit tests for snap undo/redo/info and state trimming; docs update for new snap commands.
