<img src="/assets/logo-1280-640.jpg">STAN ≜ STAN Tames Autoregressive Nonsense</img>

# STAN ≜ STAN Tames Autoregressive Nonsense

🎲 A tip of the hat to [Stanisław Ulam](https://en.wikipedia.org/wiki/Stanis%C5%82aw_Ulam).

In 1946, while recovering from illness and noodling over card games, Ulam invented the [Monte Carlo method](https://en.wikipedia.org/wiki/Monte_Carlo_method): random sampling to tackle hard, deterministic problems.

STAN produces a single source of truth for AI‑assisted development: a tarball of your repo plus deterministic outputs from your build/test/lint/typecheck scripts.

You get portable, auditable, reproducible context—locally and in CI.

Because a freaking chatbot shouldn’t gaslight your code.

## Why STAN?

- One archive (on demand). With `-a/--archive`, `archive.tar` captures the exact files to read—no surprises.
- Structured logs. `stan/test.txt`, `stan/lint.txt`, `stan/typecheck.txt`, `stan/build.txt` are consistent and easy to diff.
- Always-on diffs (when archiving). Whenever you use `-a`, STAN writes `stan/archive.diff.tar` for changed files—no extra ceremony. First time? The diff equals the full set (sensible defaults, zero ceremony).
- Snapshot with intent. Normal runs create a snapshot only when missing; use `stan snap` when you want to reset or replace it. Your diffs stay meaningful.
- Patch on tap. Got a suggested patch from an AI or teammate? Save it and run `stan patch` to apply it safely at your repo root.
- Simpler combine. With `-a -c`, script outputs live inside the archives (not on disk). No separate “combined artifact” to maintain.

Backronym bonus: Sample • Tar • Analyze • Narrate — STAN Tames Autoregressive Nonsense.

## Install

```
npm i -D @karmaniverous/stan
# or
pnpm add -D @karmaniverous/stan
# or
yarn add -D @karmaniverous/stan
```

The CLI installs as `stan`.

## Quickstart

1. Initialize config

```
npx stan init
```

This scaffolds `stan.config.yml` (or JSON) with an output path (default `stan/`) and a script map.

2. Check the config

Example `stan.config.yml`:

```
outputPath: stan
includes: []
excludes: []
scripts:
  build: npm run build
  knip: npm run knip
  lint: npm run lint
  test: npm run test
  typecheck: npm run typecheck
defaultPatchFile: /stan.patch
```

3. Generate artifacts

```
# Run all configured scripts (no archives by default)
npx stan

# Run selected scripts only (preserves order with -s)
npx stan test typecheck -s

# Run all except <keys>
npx stan -e knip lint

# Produce code archives (regular + diff) after running scripts
npx stan -a

# Put script outputs INSIDE the archives (and do not keep them on disk)
npx stan -a -c
```

## Snapshot & Diff (the duo)

- Always-on diffs (with `-a`): If you pass `-a/--archive`, STAN writes `stan/archive.diff.tar` containing only changed files since the last snapshot.
- First-run behavior: No snapshot yet? Your diff equals the full set—simple and predictable.
- Snapshot policy:
  - Normal runs: Create a snapshot only if one does not exist.
  - Explicit reset/update: Use `stan snap` to (re)write the snapshot on demand.
- Previous full archive: STAN maintains `stan/.diff/archive.prev.tar` for reference.

## CLI

```
stan [scripts...] [options]
```

### Options

- Selection
  - `[scripts...]`: run only these keys in order (when paired with `-s`).
  - `-e, --except <keys...>`: run all scripts except these.
- Execution mode
  - Default is concurrent.
  - `-s, --sequential`: run scripts sequentially, preserving enumerable order.
- Archives & outputs
  - `-a, --archive`: after scripts run, write `archive.tar` and `archive.diff.tar`.
  - `-c, --combine`: include script outputs inside the archives and do not keep them on disk. Implies `--archive` and conflicts with `--keep`.
  - `-k, --keep`: do not clear the output directory before running. Conflicts with `--combine`.

### Artifacts

- Without `-a`:
  - Per-script artifacts written on disk: `<outputPath>/<key>.txt`
  - No archives are produced.
- With `-a` (no `-c`):
  - Per-script artifacts remain on disk.
  - Archives:
    - `<outputPath>/archive.tar` (code only; excludes `<outputPath>`)
    - `<outputPath>/archive.diff.tar` (changed files only; excludes `<outputPath>`)
- With `-a -c`:
  - Script outputs are included inside both archives (`archive.tar` and `archive.diff.tar`) and removed from the output directory after archiving.
  - On disk, you will only see:
    - `<outputPath>/archive.tar`
    - `<outputPath>/archive.diff.tar`
    - `<outputPath>/.diff` (snapshot & prev archive)

### `stan snap`

Explicitly (re)generate the diff snapshot—without writing an archive:

```
npx stan snap
```

Useful when you want to “re-baseline” diffs after intentional changes.

### `stan patch`

Apply a repo-root–relative patch with a single command:

```
# Save a diff to /stan.patch, then:
npx stan patch

# or specify a file:
npx stan patch ./my-fix.patch
```

- Paths beginning with `/` are treated as repo-root relative for portability.
