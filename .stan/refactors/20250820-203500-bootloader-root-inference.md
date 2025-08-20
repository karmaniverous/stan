# Refactor: bootloader repo-root inference + stanPath fallbacks

When: 2025-08-20T20:35:00Z
Why: Some runs provided only a full archive and the assistant failed to locate stan.system.md. Root causes:

- The repository was sometimes nested under a top-level folder inside the tar.
- stanPath varied (“.stan” vs “stan”), and config discovery wasn’t robust.
  What changed:
- Clarified artifact preference ordering.
- Added repo-root inference (root or single top-level folder when it contains config or system/stan.system.md).
- Added stanPath candidate list: [configured, “.stan”, “stan”].
- Normalized all paths to POSIX slashes and accepted optional leading “./”.
- Added a debug hint to list up to 25 tar entries in the error path.

Tests/Lint:

- Policy/documentation change only; behavior change is in the assistant’s boot process.

Next:

- If future archives contain multiple nested roots, consider selecting the one containing the newest config file by mtime when metadata is available.
