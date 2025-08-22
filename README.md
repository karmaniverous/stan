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

Global install (recommended for CLI usage):

```
npm i -g @karmaniverous/stan
# or
pnpm add -g @karmaniverous/stan
# or
yarn global add @karmaniverous/stan
```

Then run the CLI as `stan ...` from any project.

Local (dev) install (optional):

```
npm i -D @karmaniverous/stan
```

The CLI installs as `stan`.

Verify:

```
stan --version
stan --help
```

## Quickstart

1. Initialize config

```
stan init
```

This scaffolds `stan.config.yml` (or JSON) with an output path (default `stan/`) and a script map.

2. Check the config

Example `stan.config.yml`:

```
stanPath: stan
includes: []
excludes: []
scripts:
  build: npm run stan:build
  lint: npm run lint
  test: npm run test
  typecheck: npm run typecheck
```

3. Generate artifacts

```
# Run all configured scripts
stan run -s

# Run selected scripts only (preserves order with -q)
stan run -s test typecheck -q

# Run all except <keys> (reduces from full set when -s absent)
stan run -x lint

# Reduce a selected set with -x
stan run -s test typecheck -x test

# Produce code archives (regular + diff) after running scripts
stan run -a -s

# Put script outputs INSIDE the archives (and do not keep them on disk)
stan run -a -c -s
```

Tip: enable debug globally

```
# Global debug applies to all subcommands
stan -d run -s
```

## Snapshot & Diff (the duo)

- Always-on diffs (with `-a`): If you pass `-a/--archive`, STAN writes `stan/archive.diff.tar` containing only changed files since the last snapshot.
- First-run behavior: No snapshot yet? Your diff equals the full set—simple and predictable.
- Snapshot policy:
  - Normal runs: Create a snapshot only if one does not exist.
  - Explicit reset/update: Use `stan snap` to (re)write the snapshot on demand.
- Previous full archive: STAN maintains `stan/diff/archive.prev.tar` for reference.

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
    - STAN logs a summary of excluded binary files and large text files to the console at archive time.
  - `-c, --combine`: include script outputs inside the archives and do not keep them on disk. Implies `--archive` and requires `-s` or `-x`. Conflicts with `--keep`.
  - `-k, --keep`: do not clear the output directory before running. Conflicts with `--combine`.

Global:

- `-d, --debug` (on `stan`): enable verbose debug logging for all subcommands.

### stan patch

Apply a patch shared via chat or a file.

Common flows:

```
# Clean and apply a patch from the clipboard (default)
stan patch

# Validate a patch from the clipboard without changing files
stan patch --check

# Read a patch from a file (unified diff) and apply it
stan patch -f my.patch

# Validate a patch file only
stan patch -f my.patch --check

# Alternatively, pass the diff inline as an argument (beware shell limits on very large diffs)
stan patch "diff --git a/x b/x
--- a/x
+++ b/x
@@ -1,1 +1,1 @@
-old
+new"
```

Behavior details:

- Canonical workspace:
  - Cleaned input is written to `<stanPath>/patch/.patch`.
  - Diagnostics live under `<stanPath>/patch/.debug/`:
    - `cleaned.patch` — the cleaned unified diff that was applied/checked.
    - `attempts.json` — summary of each apply attempt (git/jsdiff), plus
      per‑attempt `*.stderr.txt` and `*.stdout.txt`.
  - Any newly created `*.rej` files are moved to `<stanPath>/patch/rejects/<UTC timestamp>/` (paths preserved).
- Detection: If clipboard/file content looks like base64 and decodes to a unified diff (e.g., contains `diff --git`, `---`, `+++`, `@@`), it will be decoded. Otherwise, the text is treated as a raw unified diff.
- Cleanups: code fences/banners removed, zero‑width characters stripped, line endings normalized to LF, and a final newline ensured. Whitespace within lines is preserved.
- Application strategy: tries `git apply` with tolerant settings over both strip levels:
  - `--3way --whitespace=nowarn --recount -p1`
  - `--3way --ignore-whitespace --recount -p1`
  - `--reject --whitespace=nowarn --recount -p1`
  - If needed, repeats with `-p0` in the same order.
- Feedback (failed/partial/check):
  - On failure, partial success, or `--check`, STAN builds a compact FEEDBACK envelope and:
    - saves it to `<stanPath>/patch/.debug/feedback.txt`, and
    - copies it to the clipboard.
  - The console will log:
    - `stan: wrote patch feedback -> <path>`
    - `stan: copied patch feedback to clipboard -> <path>` (or `<clipboard only>` if the file write failed)
  - Paste this FEEDBACK back into chat verbatim to get a corrected patch tailored to the failure.
- Windows note: Passing very large base64 as an inline command-line argument can exceed the ~32K character limit. Clipboard default or `-f` are recommended for large patches.

### `stan snap`

Explicitly (re)generate the diff snapshot—without writing an archive:

```
stan snap
```

Useful when you want to “re-baseline” diffs after intentional changes.

## Bootloader (wire STAN into your AI agent)

STAN ships a minimal “bootloader” system prompt that you can paste into the AI assistant you use (ChatGPT, Claude, a local agent, etc.). Its only job is to:

- integrity‑check any attached tar archives,
- locate `<stanPath>/system/stan.system.md` inside the latest artifact (using stanPath from `stan.config.*`), and
- load that file as the governing system prompt for the rest of the conversation (refusing to proceed if it’s missing).

Where to find it:

- In your repo: `<stanPath>/system/stan.bootloader.md` (default: `stan/system/stan.bootloader.md`).
- From the npm package: `node_modules/@karmaniverous/stan/dist/stan.bootloader.md` (we also ship `stan.system.md` and `stan.project.template.md` under `dist/` for convenience).

How to use it:

1. Generate artifacts with STAN:
   - `stan run -a -s` (or select the scripts you need).
   - This writes `stan/output/archive.tar` (and `archive.diff.tar`).

2. In your AI tool, set the system prompt to the contents of `stan.bootloader.md`.

3. Attach `archive.tar` (and `archive.diff.tar` if present). If you used `-c/--combine`, your script outputs are already inside those archives; otherwise you can attach the text logs too.

4. State your request (e.g., “Fix the failing tests” or “Refactor X”).
   - The bootloader will switch the AI to `stan.system.md` automatically.

Troubleshooting:

- If the AI reports that `stan/system/stan.system.md` is missing, ensure:
  - your archive contains `<stanPath>/system/stan.system.md` (default `stan/system/stan.system.md`),
  - your `stan.config.yml|json` is present and has the correct `stanPath`, or
  - attach a raw file named exactly `stan.system.md` as a separate file.
  - When `--archive` runs, STAN prints a console summary of excluded binaries and large text files to help you refine `includes`/`excludes`.

---

## Snap history, stash, and archives

`snap` maintains a bounded history and can optionally stash before capturing:

- History and navigation:
  - `stan snap` — write a new snapshot (pushes history, clears redos).
  - `stan snap undo` — move to the previous snapshot and restore it.
  - `stan snap redo` — move forward in history and restore it.
  - `stan snap set 0` — jump to a specific history index and restore it.
  - `stan snap info` — show newest→oldest stack with local timestamps; marks the current index.

- Stash changes first:
  - `stan snap -s` — runs `git stash -u` before snapshot; after success, attempts `git stash pop`.
    - If `stash -u` fails: snapshot is aborted (no changes made).
    - If `stash pop` fails: a warning is logged; the snapshot remains.

- Archive captures with the snapshot:
  - If `stan/output/archive.tar` or `archive.diff.tar` exist at snap time, STAN copies them into `stan/diff/archives/` with the same timestamp stem as the snapshot (e.g., `archive-YYYYMMDD-HHMMSS.tar`).
  - Snapshots are stored under `stan/diff/snapshots/` and the active snapshot lives at `stan/diff/.archive.snapshot.json`.

- History depth:
  - Defaults to 10 entries; override by adding `maxUndos: <n>` to `stan.config.*`.

Example session:

```
# Create baseline snapshot
stan snap

# Make intentional changes, then replace baseline and capture any current archives
stan snap -s

# Inspect and navigate history
stan snap info
stan snap undo
stan snap redo
stan snap set 0
```

## Large-file guidance (300+ lines)

To keep patches focused and modules testable, STAN flags any source file longer than 300 lines and requests a plan.

What you’ll see:

- A list of long files (path + LOC).
- For each file, either:
  - a short outline for splitting it (proposed modules, responsibilities, and test strategy), or
  - a documented reason to keep it long (e.g., generated code, cohesive DSL, or deliberate monolith with clear navigation).

Example checklist (assistant output):

```
Long files (>300 LOC) detected:
1) src/feature/engine.ts — ~512 LOC
   - Proposal: Split into
     • engine/core.ts (state + lifecycle)
     • engine/plugins.ts (registry + hooks)
     • engine/runner.ts (execution, error boundaries)
   - Tests: unit per module + high-level integration

2) src/vendor/sql-grammar.ts — ~1,042 LOC
   - Decision: Keep long (generated grammar; splitting harms maintainability)
   - Action: Add a README note and exclude from coverage thresholds
```

No changes are made automatically; STAN waits for confirmation on which files to split before emitting patches.
