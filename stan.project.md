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

### stan patch (updated)

- Sources and precedence:
  - `[input]`: optional; treat as patch data (base64 or unified diff). Note Windows command line length limits.
  - `-f, --file [filename]`: read from file; if omitted, defaults to `defaultPatchFile` (usually `/stan.patch`).
  - No `[input]` and no `-f`: read from the system clipboard.
- `-c, --check`: run `git apply --check` (validate only).
- Detection & cleanup:
  - Remove code fences (```), BEGIN/END banners, zero‑width chars; normalize EOLs to LF; ensure trailing newline.
  - If content base64‑decodes to a unified diff, use decoded text; else treat as raw unified diff.
  - Write the cleaned patch to the designated patch file (clipboard/argument => defaultPatchFile; file mode => overwrite the same file).
- Application strategy (tolerant):
  - Try `--3way --whitespace=nowarn` then `--3way --ignore-whitespace` then `--reject --whitespace=nowarn`, across strip levels `-p1` then `-p0`.
  - For `--check`, perform the same strategy with `--check` and stop at first success.
- Logs:
  - Patch source (clipboard/argument/file), target file path, applied/failed (or check passed/failed).
- Windows:
  - Prefer clipboard or file mode for large patches; positional input can exceed the ~32K command line limit.

## Selection & Execution (updated)

- One of `-a/--archive`, `-s/--scripts`, or `-x/--except-scripts` is required.
- `-s, --scripts [keys...]` (optional variadic)
  - If present with keys: run exactly those keys.
  - If present with no keys: run all configured scripts.
- `-x, --except-scripts <keys...>`: reduce from `-s` set or, if `-s` is absent, from the full set.
- `-q, --sequential` requires `-s` or `-x`.

## Diff snapshot policy

- Create snapshot only if missing during runs; `stan snap` replaces it.
- Snapshot lives under `<outputPath>/.diff/.archive.snapshot.json`.

## Logging

- At the start of `stan run`, print a concise plan.
- For each script/archive action, log `stan: start "<key>"` and `stan: done "<key>" -> <path>"`.
