# STAN — STAN Tames Autoregressive Nonsense

🎲 A tip of the hat to Stanisław Ulam.

In 1946, while recovering from illness and noodling over card games, Ulam helped ignite the Monte Carlo method—random sampling to tackle hard, deterministic problems.

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
# Run all configured scripts
npx stan run -s

# Run selected scripts only (preserves order with -q)
npx stan run -s test typecheck -q

# Run all except <keys> (reduces from full set when -s absent)
npx stan run -x lint

# Reduce a selected set with -x
npx stan run -s test typecheck -x test

# Produce code archives (regular + diff) after running scripts
npx stan run -a -s

# Put script outputs INSIDE the archives (and do not keep them on disk)
npx stan run -a -c -s
```

Tip: enable debug globally

```
# Global debug applies to all subcommands
npx stan -d run -s
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
stan run [options]
```

### Options

- Selection (one of -a, -s, or -x is required)
  - `-s, --scripts [keys...]`: run only these keys. If no keys are listed, all scripts run.
  - `-x, --except-scripts <keys...>`: exclude these keys. If `-s` is present, reduces that set; otherwise reduces from the full set.
- Execution mode
  - `-q, --sequential`: run scripts sequentially in config order. Requires `-s` or `-x`.
- Archives & outputs
  - `-a, --archive`: after scripts run (or immediately if selection is empty), write `archive.tar` and `archive.diff.tar`.
  - `-c, --combine`: include script outputs inside the archives and do not keep them on disk. Implies `--archive` and requires `-s` or `-x`. Conflicts with `--keep`.
  - `-k, --keep`: do not clear the output directory before running. Conflicts with `--combine`.

Global:

- `-d, --debug` (on `stan`): enable verbose debug logging for all subcommands.

### stan patch

Apply a patch shared via chat or a file:

- Default: read from clipboard (base64 or unified diff), save to the designated patch file, apply it.
- From file: `stan patch -f` (uses the default patch file, e.g. `/stan.patch`) or `stan patch -f my.patch`
- Dry run: add `-c/--check` to validate without changing files.

Behavior details:

- Detection: If clipboard/file content looks like base64 and decodes to a unified diff (e.g., contains `diff --git`, `---`, `+++`, `@@`), it will be decoded. Otherwise, the text is treated as a raw unified diff.
- Cleanups: code fences/banners removed, zero‑width characters stripped, line endings normalized to LF, and a final newline ensured. Whitespace within lines is preserved.
- Application strategy: tries `git apply` with tolerant settings over both strip levels:
  - `--3way --whitespace=nowarn -p1`, then `--3way --ignore-whitespace -p1`, then `--reject --whitespace=nowarn -p1`
  - If needed, repeats with `-p0`
- Windows note: Passing very large base64 as an inline command-line argument can exceed the ~32K character limit. Clipboard default or `-f` are recommended for large patches.

### `stan snap`

Explicitly (re)generate the diff snapshot—without writing an archive:

```
npx stan snap
```

Useful when you want to “re-baseline” diffs after intentional changes.
