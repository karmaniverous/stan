# Project‑Specific Requirements

This file contains STAN (this repo) specific requirements and conventions. General, repo‑agnostic standards live in `/stan.system.md`.

Note: The project prompt is created on demand when repo‑specific policies emerge. No template is installed or shipped by `stan init`.

## System prompt source layout & assembly (authoring in this repo)

- Runtime invariant: downstream tools and assistants consume a single file `.stan/system/stan.system.md`. Do not change this invariant.
- Source split: author the system prompt as ordered parts under `.stan/system/parts/` (e.g., `00-intro.md`, `20-intake.md`, `30-response-format.md`, `40-patch-policy.md`, …). Filenames should start with a numeric prefix to define order.
- Generator: `npm run gen:system` assembles parts in numeric/lex order into `.stan/system/stan.system.md`, adding a short generated header comment. It is a no‑op when no parts exist.
- Distribution & archive injection:
  - The published package includes `dist/stan.system.md`.
  - During the archive phase in downstream repos, STAN temporarily writes the packaged monolith to `<stanPath>/system/stan.system.md` so full archives always contain a baseline prompt. Local monolith edits in downstream repos are ignored by archives and surfaced by CLI preflight. Propose downstream behavior changes in `<stanPath>/system/stan.project.md`.
- Editing policy:
  - Do not hand‑edit the assembled monolith; update the relevant part(s) and re‑generate.
  - Incremental migration is okay — adding parts will override the assembled monolith; leaving parts empty preserves the existing file.
- Tests: `src/stan/system.gen.test.ts` exercises basic assembly behavior.

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

## Filesystem helpers (policy)

- Prefer fs‑extra for filesystem convenience where appropriate:
  - Directory creation via ensureDir() instead of Node mkdir({ recursive: true }).
  - Existence checks via pathExists() instead of existsSync/try–catch.
- Retain Node primitives where directory type/emptiness is explicitly required:
  - stat() to determine file vs directory.
  - readdir() for directory emptiness checks and listings.
- Tests should continue to use Node primitives as needed for determinism.

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
    live: boolean
    hangWarn: number
    hangKill: number
    hangKillGrace: number
  snap:
    stash: boolean         # -s / -S
```

Built‑ins (when neither flags nor config specify): debug=false, boring=false; run: archive=true, combine=false, keep=false, sequential=false, scripts=true, live=true, hangWarn=120, hangKill=300, hangKillGrace=10; snap: stash=false; patch file unset.

## CLI (repo tool behavior)

- Root command: `stan` (supports `-d/--debug` globally).
- Subcommands:
  - `stan run` — run configured scripts to produce artifacts.
  - `stan init` — scaffold config and docs.
  - `stan snap` — create/replace the diff snapshot (without writing an archive).
  - `stan patch [input]` — apply a patch (see below).

### stan patch — failure handling (clipboard prompts; no persisted diagnostics)

- If `stan patch` fails to apply a unified diff after the git attempts and jsdiff fallback, STAN:
  - Copies to the clipboard one line per failed file: The unified diff patch for file <path/to/file.ext> was invalid. Print a full, post-patch listing of this file.
  - If clipboard access is unavailable, the same lines are printed to stdout for manual copy.
  - No diagnostic artifacts are persisted (no attempts.json, no per‑attempt logs, no feedback files).
  - The “reject” attempt (`--reject`) is not used; `.rej` files are not produced or collected.

- File Ops failure (pre‑ops):
  - On any File Ops (### File Ops) failure — parsing or execution — STAN copies the following request to the clipboard (and prints to stdout on failure), quoting the original fenced block verbatim:

  ***

  The following File Ops patch failed:

  ```
  <exact quote of file ops patch>
  ```

  ## Perform this operation with unified diff patches instead.

- Dev‑mode diagnostics (STAN repo only):
  - When running inside the STAN repository (detected via module root), failing tests and failing `stan patch` runs print concise rejection diagnostics to stderr:
    - File Ops: one line per failed operation with verb, paths, and reason.
    - Git/jsdiff: attempts tried, last exit code, trimmed excerpt of last git stderr, and jsdiff per‑file reasons.
  - No diagnostics are persisted to disk; these messages are meant to surface in test output and stan’s captured script outputs.

- Fallback ordering:
  - Keep jsdiff fallback. The engine order remains: git apply (two 3‑way attempts) → jsdiff → clipboard prompt for any remaining failed files. Partial successes request listings only for the remaining files.

### stan patch — DMP support (ladder)

- STAN accepts DMP Patch blocks (Diff Match Patch) as a first‑stage option. The ladder is:
  1. DMP patch apply with conservative fuzz and EOL preservation.
  2. git apply (3‑way attempts).
  3. jsdiff fallback.
  4. On any remaining failure, copy clipboard prompts requesting post‑patch listings for those files.

- Validator accepts DMP in `### Patch:` blocks (one patch per file remains mandatory).

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

## Patch strategy — DMP → git → jsdiff → listings (no decomposition)

- Motivation: reduce token footprint and repair churn by using a compact, fuzz‑tolerant patch first, then standard git diff, then jsdiff fallback, and finally human‑readable listings for the remaining failures.
- Ladder (one version per file per turn):
  1. DMP patch blocks (one per file). STAN applies with conservative fuzz and preserves original EOL flavor per file.
  2. git apply (two 3‑way attempts).
  3. jsdiff fallback.
  4. If any files still fail: STAN copies concise, one‑line listing requests to the clipboard for those files (and prints to stdout on clipboard failure).
- Rules and safeguards:
  - One patch per file per reply (never mix versions for the same file in a single turn). File Ops remain separate.
  - Preserve original file EOL flavor; normalize LF internally; restore on write.
  - File Ops pre‑ops remain supported; on failure, quote the block and request unified‑diff replacements (see above).

## Diff snapshot policy

- Create snapshot only if missing during runs; `stan snap` replaces it.
- Snapshot lives under `<stanPath>/diff/.archive.snapshot.json`.

## Patch processing (project‑level)

- Canonical patch workspace is `<stanPath>/patch/`:
  - Write cleaned input to `<stanPath>/patch/.patch`.
  - Do not persist per‑attempt diagnostics or .rej files.
  - Include this directory in every `archive.tar` and `archive.diff.tar`.
- On patch failures:
  - Provide clipboard listing prompts (and stdout fallback) instead of persisting diagnostics.

## Patch Extensions — File Ops (declarative)

Purpose

– Provide a safe, cross‑platform way to express repository‑structural refactors (especially large move/rename sets) inside a patch, without relying on shell. – Keep it deterministic, auditable, and portable (Node/fs‑extra semantics).

Scope

– Pre‑ops only: run file ops before applying content patches. – Allowed operations (repo‑relative, POSIX; no globs; reject absolute or “..”):

- `mv <src> <dest>`: move/rename a file or directory (recursive). Create parent folders for `<dest>`. Fail if `<src>` does not exist or `<dest>` already exists (no overwrite).
- `cp <src> <dest>`: copy a file or directory (recursive). Create parent folders for `<dest>`. Fail if `<src>` does not exist or `<dest>` already exists (no overwrite).
- `rm <path>`: remove a file or directory (recursive).
- `rmdir <path>`: remove an empty directory (explicit safety).
- `mkdirp <path>`: ensure directory exists (create all parents).

Execution semantics

– Order: execute in the listed order; stop at first failure. – Pre‑ops only: apply ops, then run the patch pipeline; on any failure, do not persist diagnostics — produce clipboard prompts as above. – Dry‑run: `stan patch --check` parses and validates ops, prints failures the same way, and makes no changes. – Dev‑mode stderr: in the STAN repo, failing tests emit concise errors to stderr for each failed op.

Validation

– For `mv`: require existing `<src>` and non‑existing `<dest>`. – For `rm`: require path exists (file or directory). – For `rmdir`: require directory exists and is empty.

Cross‑platform

– Implemented with fs‑extra on Windows/macOS/Linux (no shell).

## Patch Extensions — Exec (future, gated)

Motivation

- Rare cases may need tool‑driven transforms that are infeasible to encode as file ops or unified diffs alone.
- If introduced, must be heavily gated and non‑shell to mitigate risk.

Design (deferred)

- Opt‑in CLI flag: `stan patch --allow-exec`.
- No shell: spawn without a shell (execFile‑style) to avoid injection via quoting/redirection; workdir = repo root; bounded env; timeouts.
- Log stdout/stderr, args, exit code to `.stan/patch/.debug/exec.json`.
- Treat any non‑zero exit as failure; abort patching; include diagnostics in stderr (dev‑mode) and request listings as needed.
- Do not implement until a concrete, repeated use case emerges.

## Archiving & snapshot selection semantics (includes/excludes)

- Base selection:
  - Apply `.gitignore` semantics, default denials (`node_modules`, `.git`), user `excludes`, and STAN workspace rules.
  - Always exclude `<stanPath>/diff`; exclude `<stanPath>/output` unless the caller explicitly requests output inclusion (e.g., combine mode).
- Additive includes:
  - `includes` is an additive allow‑list: any file matching an `includes` glob is ADDED back to the base selection even if it would otherwise be excluded by `.gitignore`, user `excludes`, or default denials.
  - Reserved exclusions still apply (diff is always excluded; output excluded unless explicitly included by combine behavior).

- Order and determinism:
  - Preserve deterministic ordering by constructing a union of the base selection with the additive allow‑list while maintaining stable file ordering.

- Default sub‑package exclusion:
  - By default, exclude any top‑level folders that contain their own `package.json` (i.e., treat them as sub‑packages/workspaces) to avoid duplicating nested projects and reducing noise in archives.
  - Users can re‑include specific sub‑packages with `includes` globs (e.g., `packages/<name>/**`) when desired.

## Compression policy (archives & outputs)

- Canonical artifacts remain plain `.tar` (`archive.tar` and `archive.diff.tar`) to maximize compatibility with assistants and the bootloader’s integrity‑first tar reader.
- Research optional compression that does not compromise assistant reading or patch round‑trips:
  - Do not change the canonical `.tar` artifacts by default.
  - Explore an optional, companion compressed artifact for transport (e.g., `archive.tar.gz`) while continuing to produce the plain `.tar`.
  - Script outputs do not need to be round‑tripped into patches, but they are used for review context. Any compression of outputs must preserve practical readability in chat.

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
