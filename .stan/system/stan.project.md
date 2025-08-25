# Project‑Specific Requirements

This file contains STAN (this repo) specific requirements and conventions.
General, repo‑agnostic standards live in `/stan.system.md`.

If this file experiences significant structural changes, update
`/stan.project.template.md` to match so `stan init` scaffolds remain current.

## System prompt source layout & assembly (authoring in this repo)

- Runtime invariant: downstream tools and assistants consume a single file
  `.stan/system/stan.system.md`. Do not change this invariant.
- Source split: author the system prompt as ordered parts under
  `.stan/system/parts/` (e.g., `00-intro.md`, `20-intake.md`,
  `30-response-format.md`, `40-patch-policy.md`, …). Filenames should
  start with a numeric prefix to define order.
- Generator: `npm run gen:system` (wired as `prebuild`) assembles parts
  in numeric/lex order into `.stan/system/stan.system.md`, adding a
  short generated header comment. It is a no‑op when no parts exist.
- Editing policy:
  - Do not hand‑edit the assembled monolith; update the relevant part(s)
    and re‑generate.
  - Incremental migration is okay — adding parts will override the
    assembled monolith; leaving parts empty preserves the existing file.
- Tests: `src/stan/system.gen.test.ts` exercises basic assembly behavior.

## README authoring (trim‑and‑link)

- README.md is the human front door. Keep it concise:
  value proposition, install, quick start (STAN loop), key CLI examples,
  and links to full documentation.
- For deep or evolving sections (full CLI semantics, detailed patch
  walk‑throughs, design essays), prefer the docs site (Typedoc pages or
  dedicated markdown under `docs/`) and link from README.
- Community edits should remain easy (single README.md at repo root).
  Avoid generating README unless necessary.

## Documentation conventions (requirements vs plan)

- This file (stan.project.md) is the canonical home for durable, repo‑specific
  requirements, policies, and standards that should persist over time.
- The development plan (stan.todo.md) is a short‑lived, actionable plan that
  describes how we intend to move from the current state to the desired state.
  It should remain concise and focused on what’s next.
- When we discover cross‑cutting rules, rename conventions, guardrails, or
  recurring decisions that apply going forward, promote them here (project
  prompt). Keep stan.todo.md focused on the remaining steps to implement or
  adopt those rules.
- Dev plan hygiene:
  - Keep only a short “Completed (recent)” list (e.g., last 3–5 items or last
    2 weeks) and prune older entries during routine updates.
  - Rely on Git history and release notes for long‑term record of completed work.
  - When a completed item establishes a durable policy, capture that policy
    here (project prompt) and remove it from “Completed” in the dev plan.

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
  - When `git apply` produces `*.rej` files, move any newly created rejects under `<stanPath>/patch/rejects/<UTC>/`, preserving relative paths.

### stan snap

- `snap` (default): creates/replaces the diff snapshot. With `-s/--stash`, stash before and pop after; on stash failure, abort (no snapshot).
- `snap undo` / `snap redo`: navigate history; restore `.archive.snapshot.json`.
- `snap set <index>`: jump to a specific history index and restore it.
- `snap info`: print history entries with newest first. Each line shows:
  - `[*] [index] <local timestamp>  file: <snapshot-filename>  archive: yes|no  diff: yes|no`
  - `*` marks the current entry in the stack.
- History lives under `<stanPath>/diff`: `.snap.state.json`, `snapshots/`, and optional `archives/` captures.
- Trimming: respect `maxUndos` (default 10).

## Selection & Execution (current semantics)

- Defaults (no flags):
  - Runs all configured scripts in config order (concurrent by default).
  - Writes both `archive.tar` and `archive.diff.tar`.
- Planning and toggles:
  - `-p, --plan` prints the run plan and exits without side effects.
  - `-S, --no-scripts` disables script execution.
  - `-A, --no-archive` disables archives (default is ON unless explicitly negated).
  - `-c, --combine` includes outputs inside archives and removes them on disk (implies `--archive`).
  - `-q, --sequential` runs scripts sequentially (with `-s` preserves provided order; otherwise config order).
- Selection:
  - `-s, --scripts [keys...]` selects listed keys (if no keys are provided, selects all).
  - `-x, --except-scripts <keys...>` excludes keys (reduces from `-s` when present; otherwise from full set).
- Conflicts:
  - `-S` conflicts with `-s`/`-x`.
  - `-c` conflicts with `-A` (runtime check).

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
  - Propose concrete code changes (and tests) to `src/stan/patch/*` and related utilities.

## Logging

- At the start of `stan run`, print a concise plan.
- For each script/archive action, log `stan: start "<key>"` and `stan: done "<key>" -> <path>"`.
- Archive warnings: do not write a warnings file. Print a console summary of excluded binaries and large text files when creating archives.
