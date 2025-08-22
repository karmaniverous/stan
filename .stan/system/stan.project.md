# Project‑Specific Requirements

This file contains STAN (this repo) specific requirements and conventions.
General, repo‑agnostic standards live in `/stan.system.md`.

If this file experiences significant structural changes, update
`/stan.project.template.md` to match so `stan init` scaffolds remain current.

## Build

- Rollup builds:
  - `dist/mjs` + `dist/cjs` (library),
  - `dist/cli` (executables, with shebang),
  - `dist/types` (d.ts bundle).
- Use the `@` alias at build time via Rollup alias config.
- The `stan.dist/` build is used for internal CLI testing (`npm run stan:build`)
  and is cleaned after build.

## CLI (repo tool behavior)

- Root command: `stan` (supports `-d/--debug` globally).
- Subcommands:
  - `stan run` — run configured scripts to produce artifacts.
  - `stan init` — scaffold config and docs.
  - `stan snap` — create/replace the diff snapshot (without writing an archive).
  - `stan patch [input]` — apply a git patch (see below).

### stan patch

- Sources and precedence:
  - `[input]`: optional; treat as patch data (base64 or unified diff). Note Windows command line length limits.
  - `-f, --file [filename]`: read from file as source.
  - No `[input]` and no `-f`: read from the system clipboard.
- Processing & storage:
  - Clean the input (remove outer wrappers, normalize EOL to LF, strip zero‑width, extract unified diff).
  - Always write the cleaned patch to `<stanPath>/patch/.patch`; diagnostics to `<stanPath>/patch/.debug/`.
  - Apply the patch staged by default (`git apply --index`), or use `--check` to validate only.
- Application strategy (tolerant):
  - Try `--3way --whitespace=nowarn --recount`, then `--3way --ignore-whitespace --recount`, then `--reject --whitespace=nowarn --recount`, across `-p1` then `-p0`.
  - Consider adding `-C1` tolerance in the future if needed.
- Logs:
  - Patch source (clipboard/argument/file), target file path, applied/failed (or check passed/failed).
  - Write attempts and stderr/stdout sizes in `.debug/attempts.json`, plus per‑attempt stderr/stdout files.
- Rejects:
  - When `git apply` produces `*.rej` files, move any newly created rejects to `<stanPath>/refactors/patch-rejects-<UTC timestamp>/` preserving relative paths.

### stan snap

- `snap` (default): creates/replaces the diff snapshot. With `-s/--stash`, stash before and pop after; on stash failure, abort (no snapshot).
- `snap undo` / `snap redo`: navigate history; restore `.archive.snapshot.json`.
- `snap set <index>`: jump to a specific history index and restore it.
- `snap info`: print history entries with newest first. Each line shows:
  - `[*] [index] <local timestamp>  file: <snapshot-filename>  archive: yes|no  diff: yes|no`
  - `*` marks the current entry in the stack.
- History lives under `<stanPath>/diff`: `.snap.state.json`, `snapshots/`, and optional `archives/` captures.
- Trimming: respect `maxUndos` (default 10).

## Selection & Execution

- One of `-a/--archive`, `-s/--scripts`, or `-x/--except-scripts` is required.
- `-s, --scripts [keys...]` (optional variadic)
  - If present with keys: run exactly those keys.
  - If present with no keys: run all configured scripts.
- `-x, --except-scripts <keys...>`: reduce from `-s` set or, if `-s` is absent, from the full set.
- `-q, --sequential` requires `-s` or `-x`.

## Diff snapshot policy

- Create snapshot only if missing during runs; `stan snap` replaces it.
- Snapshot lives under `<stanPath>/diff/.archive.snapshot.json`.

## Patch processing (project‑level)

- Canonical patch workspace is `<stanPath>/patch/`:
  - Write cleaned input to `<stanPath>/patch/.patch`.
  - Write diagnostics to `<stanPath>/patch/.debug/`.
  - Include this directory in every `archive.tar` and `archive.diff.tar`.
  - Clear this directory whenever a new archive is generated.
- On patch failures:
  - Analyze failures for processing improvements (parsing, cleaning, tolerant apply strategies).
  - Propose concrete code changes (and tests) to `src/stan/patch.ts` and related utilities.
  - Prefer staging (`git apply --index`) when applying patches; do not stage for `--check`.
  - Capture attempts and stderr in `.debug/` and attach a brief summary in chat.

## Logging

- At the start of `stan run`, print a concise plan.
- For each script/archive action, log `stan: start "<key>"` and `stan: done "<key>" -> <path>"`.
- Archive warnings: do not write a warnings file. Print a console summary of excluded binaries and large text files when creating archives
