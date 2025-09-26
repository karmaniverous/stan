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

### stan patch — failure handling (downstream vs STAN repo)

Goals:

- Downstream repos: keep the loop moving (request what’s needed next).
- STAN repo: improve STAN first (diagnose, decide whether to fix generator vs handler), keep the loop context alive.

Common behavior

- No FEEDBACK envelopes.
- No persisted diagnostics (.rej, attempts.json, per‑attempt logs).
- Clipboard‑first; stdout fallback when clipboard unavailable.

Downstream repos

- Diff Patch (one‑file rule in effect):
  - For each failed file, copy to clipboard:
    ```
    The unified diff patch for file <path/to/file.ext> was invalid. Print a full, post-patch listing of this file.
    ```
  - Insert a blank line between multiple failures for readability.
- File Ops:
  - Copy to clipboard:

    ```
    The following File Ops patch failed:

    <verbatim File Ops block>

    Perform this operation with unified diff patches instead.
    ```

  - Insert a blank line between multiple outputs if they occur.

STAN repo only

- Diff Patch:
  - Copy to clipboard:

    ```
    The unified diff patch for file <path/to/file.ext> was invalid.

    START PATCH DIAGNOSTICS
    <stderr from patch ingestion>
    END PATCH DIAGNOSTICS
    ```

  - Verbatim stderr: do not trim. If git produced no stderr and jsdiff was attempted, include concise jsdiff reason lines instead:
    ```
    jsdiff: <path>: <reason>
    ```
  - No listing request here (avoid confusing the assistant).

- File Ops:
  - Copy to clipboard:

    ```
    The File Ops patch failed.

    START PATCH DIAGNOSTICS
    <parser and/or exec failures; one per line>
    END PATCH DIAGNOSTICS
    ```

  - No “perform with unified diffs” line in the STAN repo variant.

Block semantics

- One diagnostics block per failure (matches “one patch” under the one‑diff‑per‑file rule). For File Ops (which may cover many paths), diagnostics still appear once per ops patch.

### Patch diagnostics review (STAN repo only — assistant behavior)

When `stan patch` fails and emits a diagnostics block:

1. Read and correlate

- Read diagnostics between START/END PATCH DIAGNOSTICS.
- Compare messages (git apply, jsdiff reasons, file‑ops lines) to the patch content still in chat context.

2. Classify

- Likely generation issue (fixable in the project/system prompts):
  - Symptoms: malformed unified diff (stray “@@” outside hunks, bad headers, missing `diff --git`, mismatched counts, etc.).
  - Action: propose small, targeted prompt/validator/test updates. If low risk, offer to fix now; otherwise log a task in the dev plan.
- Likely handling/path/system issue (fixable in STAN code):
  - Symptoms: file not found, strip confusion (p1 vs p0), a/b prefixes handling, edge cases in fallback ordering, parser tolerances.
  - Action: propose small code fixes + tests; fix now if low risk; otherwise log a task.
- Context drift/ambiguous:
  - Request the full post‑patch listing(s) for the relevant file(s) and continue the loop.

3. Offer choices

- (a) Fix now (if safe/small),
- (b) Log a task (defer),
- (c) Ignore diagnostics and request listings (diff patches) or unified diffs (file ops), as appropriate.

4. Group failures

- If multiple failures were pasted (rare under one‑diff‑per‑file), evaluate all and propose a combined course of action.

### stan patch — DMP support (ladder; future)

- Ladder: DMP → git apply (two 3‑way attempts) → jsdiff fallback → diagnostics/requests as above.
- Reuse the same diagnostics envelope:
  - Prefer DMP stderr; otherwise include concise reason lines when no stderr exists.

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

## Patch strategy — DMP → git → jsdiff → diagnostics/listings

- Motivation: reduce token footprint and repair churn by using a compact, fuzz‑tolerant patch first, then standard git diff, then jsdiff fallback, and finally diagnostics/requests to keep the loop moving (downstream) or improve STAN (STAN repo).
- Ladder (one version per file per turn):
  1. DMP patch blocks (one per file). STAN applies with conservative fuzz and preserves original EOL flavor per file.
  2. `git apply` (two 3‑way attempts).
  3. jsdiff fallback.
  4. If any files still fail:
     - Downstream: concise one‑line listing requests for those files.
     - STAN repo: diagnostics envelope (START/END) for analysis.

- Rules and safeguards:
  - One patch per file per reply (never mix versions for the same file in a single turn). File Ops remain separate.
  - Preserve original file EOL flavor; normalize LF internally; restore on write.
  - File Ops pre‑ops remain supported; on failure, the STAN‑repo payload is diagnostics, downstream payload is the unified‑diff re‑request.

## Diff snapshot policy

- Create snapshot only if missing during runs; `stan snap` replaces it.
- Snapshot lives under `<stanPath>/diff/.archive.snapshot.json`.

## Patch processing (project‑level)

- Canonical patch workspace is `<stanPath>/patch/`:
  - Write cleaned input to `<stanPath>/patch/.patch`.
  - Do not persist per‑attempt diagnostics or .rej files.
  - Include this directory in every `archive.tar` and `archive.diff.tar`.

## Patch Extensions — File Ops (declarative)

Purpose: Provide a safe, cross‑platform way to express repository‑structural refactors (especially large move/rename sets) inside a patch, without relying on shell.

- Verbs: `mv <src> <dest>` | `cp <src> <dest>` | `rm <path>` | `rmdir <path>` | `mkdirp <path>`
- Paths: POSIX, repo‑relative only; forbid absolute or traversal outside repo root after normalization.
- mv/cp: no overwrite; create parents for `<dest>`.
- rm: recursive file/dir removal; rmdir: empty directories only.
- Dry‑run (`--check`) validates without changing the filesystem.
- STAN repo failure payload: diagnostics envelope (no instruction line).
- Downstream failure payload: re‑request to express as unified diffs (with the original ops block quoted), plus spacing between multiple outputs.

## Patch Extensions — Exec (future, gated)

- If introduced, must be heavily gated and non‑shell. (See prior policy in the system prompt.)

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
- Research optional compression for transport without changing the canonical `.tar` outputs.

## Logging

- At the start of `stan run`, print a concise plan.
- In live (TTY) mode, legacy “start/done” archive lines are suppressed; progress is rendered in the live table with status colors and durations.
- Archive warnings are printed to the console (no file output).

## Assistant reply ordering (local policy)

- When presenting both a Patch and a Full Listing for the same file in a single reply, the Patch MUST appear before the Full Listing.
  - Rationale: reviewers can see the change first, then consult the full file for context.
  - Implications:
    - For each changed file, order sections as:
      1. “### Patch: path/to/file.ext”
      2. “### Full Listing: path/to/file.ext”
