# Project‑Specific Requirements

This file contains STAN (this repo) specific requirements and conventions. General, repo‑agnostic standards live in `/stan.system.md`.

Note: The project prompt is created on demand when repo‑specific policies emerge. No template is installed or shipped by `stan init`.

## System prompt source layout & assembly (authoring in this repo)

- Runtime invariant: downstream tools and assistants consume a single file `.stan/system/stan.system.md`. Do not change this invariant.
- Source split: author the system prompt as ordered parts under `.stan/system/parts/` (e.g., `00-intro.md`, `20-intake.md`, `30-response-format.md`, `40-patch-policy.md`, …). Filenames should start with a numeric prefix to define order.
- Generator: `npm run gen:system` (wired as `prebuild`) assembles parts in numeric/lex order into `.stan/system/stan.system.md`, adding a short generated header comment. It is a no‑op when no parts exist.
- Distribution & archive injection:
  - The published package includes `dist/stan.system.md`.
  - During the archive phase in downstream repos, STAN temporarily writes the packaged monolith to `<stanPath>/system/stan.system.md` so full archives always contain a baseline prompt. Local monolith edits in downstream repos are ignored by archives and surfaced by CLI preflight. Propose downstream behavior changes in `<stanPath>/system/stan.project.md`.
- Editing policy:
  - Do not hand‑edit the assembled monolith; update the relevant part(s) and re‑generate.
  - Incremental migration is okay — adding parts will override the assembled monolith; leaving parts empty preserves the existing file.
- Tests: `src/stan/system.gen.test.ts` exercises basic assembly behavior.

## README authoring (trim‑and‑link)

- README.md is the human front door. Keep it concise: value proposition, install, quick start (STAN loop), key CLI examples, and links to full documentation.
- For deep or evolving sections (full CLI semantics, detailed patch walk‑throughs, design essays), prefer the docs site (Typedoc pages or dedicated markdown under `docs/`) and link from README.
- Community edits should remain easy (single README.md at repo root). Avoid generating README unless necessary.

## Documentation conventions (requirements vs plan)

- This file (stan.project.md) is the canonical home for durable, repo‑specific requirements, policies, and standards that should persist over time.
- The development plan (stan.todo.md) is a short‑lived, actionable plan that describes how we intend to move from the current state to the desired state. It should remain concise and focused on what’s next.
- When we discover cross‑cutting rules, rename conventions, guardrails, or recurring decisions that apply going forward, promote them here (project prompt). Keep stan.todo.md focused on the remaining steps to implement or adopt those rules.
- Dev plan hygiene:
  - Keep only a short “Completed (recent)” list (e.g., last 3–5 items or last 2 weeks) and prune older entries during routine updates.
  - Rely on Git history and release notes for long‑term record of completed work.
  - When a completed item establishes a durable policy, capture that policy here (project prompt) and remove it from “Completed” in the dev plan.

## Prompt scope boundaries (system vs project)

- The system prompt (`<stanPath>/system/stan.system.md`) is repo‑agnostic. Do not embed STAN‑repo‑only workflows there.
- Use this project prompt to record STAN‑repo‑specific policy:
  - How the system prompt is authored and assembled (parts → monolith).
  - Distribution and archive behavior (packaged monolith injection).
  - Any STAN‑repo maintenance or contribution guidance.
- In downstream repos, assistants should treat `stan.system.md` as read‑only and propose behavior changes in `<stanPath>/system/stan.project.md`. CLI preflight will surface local monolith drift and `stan init` will update docs metadata.

## Build

- Rollup builds:
  - `dist/mjs` + `dist/cjs` (library),
  - `dist/cli` (executables, with shebang),
  - `dist/types` (d.ts bundle).
- Use the `@` alias at build time via Rollup alias config.
- d.ts bundling: apply the alias plugin alongside `rollup-plugin-dts` in the types build to resolve `"@/..."` path aliases reliably.
- The `stan.dist/` build is used for internal CLI testing (`npm run stan:build`) and is cleaned after build.

## CLI defaults via configuration (cliDefaults)

The CLI honors phase‑scoped defaults when flags are omitted. Precedence is:

- Flags > cliDefaults > built‑ins.

Schema (all keys optional):

```
cliDefaults:
  boring: boolean          # root -b / -B
  debug: boolean           # root -d / -D
  patch:
    file: string           # default patch file; overridden by arg or -f; ignored by -F/--no-file
  run:
    archive: boolean       # -a / -A; combine implies archive=true
    combine: boolean       # -c / -C
    keep: boolean          # -k / -K
    sequential: boolean    # -q / -Q
    scripts: boolean | string[]  # default selection when neither -s is omitted nor -S used:
                                 #   true => all, false => none, ["lint","test"] => only these keys
  snap:
    stash: boolean         # -s / -S
```

Built‑ins (when neither flags nor config specify): debug=false, boring=false; run: archive=true, combine=false, keep=false, sequential=false, scripts=true; snap: stash=false; patch file unset.

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
- `snap info`: print the snapshot stack and current position.
- History lives under `<stanPath>/diff`: `.snap.state.json`, `snapshots/`, and optional `archives/` captures.
- Trimming: respect `maxUndos` (default 10).

### stan init

- Interactive and forced modes are supported.
- Script preservation logic:
  - When the user elects to preserve existing scripts (interactive) or passes `--preserve-scripts`, skip the script‑selection step entirely and retain `scripts` from the current `stan.config.*` (updating only other answers such as `stanPath`, includes/excludes, etc.).
  - When not preserving, prompt for script selection from `package.json` keys and materialize them as `npm run <key>` commands in `stan.config.yml`.

## Selection & Execution (current semantics)

- Defaults (no flags):
  - Runs all configured scripts in config order (concurrent by default).
  - Writes both `archive.tar` and `archive.diff.tar`.
- Planning and toggles:
  - `-p, --plan` prints the run plan and exits without side effects.
  - `-P, --no-plan` executes without printing the run plan first.
  - `-S, --no-scripts` disables script execution.
  - `-A, --no-archive` disables archives (default is ON unless explicitly negated).
  - `-c, --combine` includes outputs inside archives and removes them on disk (implies `--archive`).
  - `-q, --sequential` runs scripts sequentially (with `-s` preserves provided order; otherwise config order).
- Selection:
  - `-s, --scripts [keys...]` selects listed keys (if no keys are provided, selects all).
  - `-x, --except-scripts <keys...>` excludes keys (reduces from `-s` when present; otherwise from full set).
- Conflicts:
  - `-S` conflicts with `-s`/`-x`.
  - `-c` conflicts with `-A` (parse‑time via Commander conflicts).
  - Live progress & thresholds (TTY):
    - `-l, --live` / `-L, --no-live` toggle the live progress table (default: live enabled).
    - `--hang-warn <s>` label a running script as “stalled” after N seconds of inactivity.
    - `--hang-kill <s>` terminate stalled scripts after N seconds (SIGTERM → grace → SIGKILL).
    - `--hang-kill-grace <s>` grace period before SIGKILL after SIGTERM.
    - Built‑in defaults (when not specified via flags or cliDefaults.run):
      - hang‑warn: 120s
      - hang‑kill: 300s
      - hang‑kill‑grace: 10s

Short negative flags:

- Root: `-D` (no-debug), `-B` (no-boring)
- Run: `-Q` (no-sequential), `-K` (no-keep), `-C` (no-combine); Snap: `-S` (no-stash)

## Staged imports (imports)

Bring small, high‑signal artifacts into the STAN workspace just before archiving, without teaching STAN any language/build specifics.

- Config
  - `imports?: Record<label, string | string[]>`
  - Each label maps to one or more glob patterns (relative to the repo root; `../` allowed).

- Behavior (archiving only)
  - During `stan run` (only when archives are being written), stage matched files under `<stanPath>/imports/<label>/…`.
  - Rebuild per label deterministically on each run (imports are not affected by “keep” semantics).
  - Binary screening still applies when building the archives; prefer text artifacts (schemas, headers, d.ts, API JSONs, GraphQL/OpenAPI, etc.).

- Mapping
  - For each glob, preserve the relative “tail” under the static part of the glob (via `glob-parent`), so nested structures survive:
    - Example: `../lib/dist/api/**/*.json` → `.stan/imports/contracts/api/<subdirs>/<file>.json`.
  - Labels may include `@` and `/` (e.g., `@scope/pkg`) and become nested folders; forbid `..`.
  - Label sanitation: allow `A–Z a–z 0–9 @ / _ -`; replace other characters with `_`; reject any label resolving to or containing `..`.

- Scope
  - `run` archive phase only. `snap` and `patch` do not stage imports.
  - “keep” semantics apply only to `<stanPath>/output`; imports are always rebuilt for determinism.

- Logging
  - One concise line per label (always printed; before the archive table rows in live/no‑live modes):
    - `stan: import <label> -> N file(s)`

- Dependencies (module)
  - Runtime: `fast-glob` and `glob-parent` used within the imports helper.
  - Keep usage local to the staging helper; do not change classifier or reserved exclusions.

- Tests (summary)
  - Unit: config parsing/normalization; label sanitation (e.g., `@scope/pkg`, `core//api`, `../bad`); path mapping examples:
    - `../lib/dist/*.d.ts` → basename only
    - `../lib/dist/api/**/*.json` → `api/<subdirs>/<file>.json`
    - `./generated/openapi/**/*.yaml` → `openapi/<subdirs>/<file>.yaml`
  - Integration: in run combine/no‑combine modes, assert that `<stanPath>/imports/<label>/…` files are included in archives (classifier continues to exclude binaries).
  - Ensure staging runs only when archives are being written (`archive=true`); plan‑only and `snap` do not stage.
  - Windows/CI hardening: clean per‑label dir; avoid leaving handles open; follow existing test teardown patterns (cwd reset + stdin pause).

- CLI/config example
  ```yaml
  imports:
    @karmaniverous/stan-core:
      - ../stan-core/dist/**/*.d.ts
      - ../stan-core/dist/api/**/*.json
    openapi:
      - ./generated/openapi/**/*.yaml
  ```

Notes
- Naming uses “imports” to avoid overloading “context” (which collides with LLM session context and internal types).
- The staging folder is `<stanPath>/imports/<label>/…` to align with the config key and CLI log.

## Diff snapshot policy

- Create snapshot only if missing during runs; `stan snap` replaces it.- Snapshot lives under `<stanPath>/diff/.archive.snapshot.json`.

## Patch processing (project‑level)

- Canonical patch workspace is `<stanPath>/patch/`:
  - Write cleaned input to `<stanPath>/patch/.patch`.
  - Write diagnostics to `<stanPath>/patch/.debug/`.
  - Include this directory in every `archive.tar` and `archive.diff.tar`.
  - Clear this directory whenever a new archive is generated.
- On patch failures:
  - Analyze failures for processing improvements (parsing, cleaning, tolerant apply strategies).
  - Propose concrete code changes (and tests) to `src/stan/patch/*` and related utilities.

## Archiving & snapshot selection semantics (includes/excludes)

- Base selection:
  - Apply `.gitignore` semantics, default denials (`node_modules`, `.git`), user `excludes`, and STAN workspace rules.
  - Always exclude `<stanPath>/diff`; exclude `<stanPath>/output` unless the caller explicitly requests output inclusion (e.g., combine mode).

- Additive includes:
  - `includes` is an additive allow‑list: any file matching an `includes` glob is ADDED back to the base selection even if it would otherwise be excluded by `.gitignore`, user `excludes`, or default denials.
  - Reserved exclusions still apply (diff is always excluded; output excluded unless explicitly included by combine behavior).

- Order and determinism:
  - Preserve deterministic ordering by constructing a union of the base selection with the additive allow‑list while maintaining stable file ordering.

- Default sub‑package exclusion (new):
  - By default, exclude any top‑level folders that contain their own `package.json` (i.e., treat them as sub‑packages/workspaces) to avoid duplicating nested projects and reducing noise in archives.
  - Users can re‑include specific sub‑packages with `includes` globs (e.g., `packages/appA/**`) when desired.
  - Exclusion applies to the first level below the repo root (e.g., `packages/<name>` or any other root child with a `package.json`), not to the repo root itself.

## Compression policy (archives & outputs)

- Canonical artifacts remain plain `.tar` (`archive.tar` and `archive.diff.tar`) to maximize compatibility with assistants and the bootloader’s integrity‑first tar reader.
- Research optional compression that does not compromise assistant reading or patch round‑trips:
  - Do not change the canonical `.tar` artifacts by default.
  - Explore an optional, companion compressed artifact for transport (e.g., `archive.tar.gz`) while continuing to produce the plain `.tar`.
  - Script outputs do not need to be round‑tripped into patches, but they are used for review context. Any compression of outputs must preserve practical readability in chat (for example, consider an optional `outputs.summary.txt` plus compressed raw outputs, or compress only in secondary artifacts).
- Any compression feature must be behind an opt‑in flag/config and accompanied by documentation and tests.

## Logging

- At the start of `stan run`, print a concise plan.
- For each script/archive action in no‑live mode, log `stan: start "<key>"` and `stan: done "<key>" -> <path>"`.
  - In live (TTY) mode, these legacy start/done lines are suppressed; progress is rendered in the live table with status colors and durations.
- Archive warnings: do not write a warnings file. Print a console summary of excluded binaries and large text files when creating archives.

## Assistant reply ordering (local policy)

- When presenting both a Patch and a Full Listing for the same file in a single reply, the Patch MUST appear before the Full Listing.
  - Rationale: reviewers can see the change first, then consult the full file for context.
  - Implications:
    - For each changed file, order sections as:
      1. “### Patch: path/to/file.ext”
      2. “### Full Listing: path/to/file.ext”
    - Future validators should assert this ordering per file when both blocks are present.
