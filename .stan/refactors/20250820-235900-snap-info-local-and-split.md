# Refactor: snap info local time + CLI split helpers

When: 2025-08-20T23:59:00Z
Why: Make `stan snap info` show timestamps in the local system time zone and shorten CLI files by extracting shared helpers.
What changed:
- src/stan/snap.ts: print local timestamps via formatUtcStampLocal; fixed import order; removed inline helpers/constants.
- src/stan/snap/shared.ts: new module providing STATE_FILE/SNAP_DIR/ARCH_DIR and common IO helpers (readJson, writeJson, ensureDirs, within).

Tests/Lint:
- Lint: import order for snap.ts is now sorted; shared helpers reduce file length.
- Tests: behavior-based tests remain valid; info output is more readable.

Next:
- Consider further splitting: move stash handling and archive capture into small utilities under src/stan/snap/.
