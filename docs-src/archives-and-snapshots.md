# Archives & snapshots

## Artifacts

- `<stanPath>/output/archive.tar` — full snapshot of repo files (excludes binaries).
- `<stanPath>/output/archive.diff.tar` — changed files vs snapshot (always when archiving).
- `*.txt` outputs — deterministic stdout/stderr from scripts.

Attach `archive.tar` (and `archive.diff.tar` if present) in chat.

## Combine mode

Include outputs inside archives and remove them from disk:

```
stan run -c
```

Regular archive includes `<stanPath>/output` (excluding the archive files themselves).
Diff archive excludes `<stanPath>/diff` and both archive files.

## Snapshot policy

`stan snap` writes `<stanPath>/diff/.archive.snapshot.json` and maintains an
undo/redo history under `<stanPath>/diff`:

```
stan snap
stan snap info | undo | redo | set <index>
stan snap -s    # stash before snapping; pop after
```

Snapshots are used to compute archive diffs; `stan run` creates a diff archive even
when nothing changed (a sentinel is written in that case).

## Preflight

At the start of `stan run`, `stan snap`, and `stan patch`, STAN:

- compares your local system prompt to the packaged baseline and warns about drift,
- nudges to run `stan init` after upgrades if the docs baseline changed,
- prints concise guidance (TTY-aware).
