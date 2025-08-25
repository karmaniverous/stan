<!-- TYPEDOC_EXCLUDE -->

> [API Documentation](https://karmaniverous.github.io/stan) • [CHANGELOG](https://github.com/karmaniverous/stan/tree/main/CHANGELOG.md)

<!-- /TYPEDOC_EXCLUDE -->

# STAN — STAN Tames Autoregressive Nonsense

![STAN Loop](https://github.com/karmaniverous/stan/raw/main/assets/stan-loop.png)

In 1946, while recovering from illness and noodling over card games, Stanisław Ulam helped ignite the Monte Carlo method—random sampling to tackle hard, deterministic problems.

STAN produces a single source of truth for AI‑assisted development: a tarball of your repo plus deterministic outputs from your build/test/lint/typecheck scripts.

You get portable, auditable, reproducible context—locally and in CI.

Because a freaking chatbot shouldn’t gaslight your code.

---

## The STAN Loop

The diagram above shows the three‑stage loop that makes STAN predictable and fast to work with. Each stage ends with one command—keep the loop light and repeat until done.

### 1) Build & Snapshot

- Edit code
- Review outputs
- Run: `stan run`

What happens:

- `stan run` executes your configured scripts (lint/test/typecheck/build) and writes clean, deterministic text outputs to `<stanPath>/output/*.txt`.
- With `-a/--archive`, it also writes `archive.tar` plus `archive.diff.tar` (diff vs last snapshot).
- With `-c/--combine`, those outputs are placed inside the archives and removed on disk.
- A multi‑line “run plan” is printed: mode, output location, script selection, archive/combine/keep flags.
- Preflight checks may warn if your local system prompt diverges from the packaged baseline and nudge you to run `stan init` after upgrades.

Pro tips:

- Use `-s/--scripts` or `-x/--except-scripts` for targeted runs; `-q/--sequential` preserves config order for debugging.
- Use `-d/--debug` to stream through stdout/stderr during script execution.
- Use `-b/--boring` in CI to disable color.

### 2) Share & Baseline

- Attach archives + notes
- State requirements
- Run: `stan snap`

What happens:

- Drop the outputs and/or archives into your chat (and include a short requirements note).
- `stan snap` records the current file content snapshot under `<stanPath>/diff/.archive.snapshot.json`, keeping a bounded history with undo/redo/set/info commands.
- If you had archives in `<stanPath>/output`, they are copied into the diff archives folder alongside the snapshot for traceability.

Pro tips:

- Always attach `<stanPath>/output/archive.tar` to a new thread; your assistant isn’t guessing from memory.
- Use `archive.diff.tar` for subsequent updates in the same thread.
- The bootloader (`<stanPath>/system/stan.bootloader.md`) makes assistants integrity‑check tars and load the real system prompt from `<stanPath>/system/stan.system.md` before proceeding.

### 3) Discuss & Patch

- Iterate to solution
- Get patches + commit
- Run: `stan patch`

What happens:

- Discuss the requirements and converge on a solution. STAN returns plain unified diffs and a commit message.
- Run `stan patch` to apply the patch locally:
  - Cleans the text, writes `<stanPath>/patch/.patch`, and attempts to apply:
    1. `git apply` across tolerant settings and strip levels (p1→p0),
    2. falls back to a jsdiff engine for placement when necessary.
  - After success (non‑`--check`), opens the modified files in your editor (configurable).
  - If a patch fails, builds a compact FEEDBACK packet and opens target files to speed manual edits; the packet is also copied to your clipboard when possible.
- Repeat the loop until done.

Pro tips:

- Use `stan patch --check` to validate only (no file changes).
- Use `stan patch -f <file>` to apply from a file source; omit to read from clipboard; pass a diff as a single argument for quick tests.

---

## Why STAN?

- One archive (on demand). With `-a/--archive`, `archive.tar` captures the exact files to read—no surprises.
- Structured logs. `stan/test.txt`, `stan/lint.txt`, `stan/typecheck.txt`, `stan/build.txt` are consistent and easy to diff.
- Always‑on diffs (when archiving). Whenever you use `-a`, STAN writes `archive.diff.tar` for changed files—no extra ceremony. First time? The diff equals the full set (sensible defaults, zero ceremony).
- Snapshot with intent. Normal runs create a snapshot only when missing; use `stan snap` when you want to reset or replace it. Your diffs stay meaningful.
- Patch on tap. Got a suggested patch? Paste it or pass a file and run `stan patch` to apply it safely at your repo root. Failures produce a FEEDBACK packet so you can ask for a corrected patch.
- Simpler combine. With `-a -c`, script outputs live inside the archives (not on disk). No separate “combined artifact” to maintain.
- Preflight guardrails. When your downstream system prompt drifts from the packaged baseline, STAN nudges you to update via `stan init`.

Backronym bonus: Sample • Tar • Analyze • Narrate — STAN Tames Autoregressive Nonsense.

---

## Install

Global (recommended for CLI usage):

```
npm i -g @karmaniverous/stan
# or
pnpm add -g @karmaniverous/stan
# or
yarn global add @karmaniverous/stan
```

Local (dev) install (optional):

```
npm i -D @karmaniverous/stan
```

Verify:

```
stan --version
stan --help
```

---

## Getting started

1. Initialize STAN in your repo (creates `stan.config.yml` and scaffolds docs):

```
stan init
```

2. Exclude the STAN workspace from analyzers.

- ESLint (flat config): ensure `ignores` include `<stanPath>/**` (default `.stan/**`).
- Do the same for formatters/typecheckers that scan the whole tree.

3. Run the loop (see “The STAN loop” above).

- Build & Snapshot: `stan run` (optionally `-a` and `-c`).
- Share & Baseline: attach archives + requirements, then `stan snap`.
- Discuss & Patch: iterate in chat, then `stan patch`.

Tip: If you change `stanPath` in `stan.config.*`, update your ignores.

---

## Configuration

`stan.config.yml` example:

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

- `stanPath`: workspace folder (default `.stan`).
- `includes`: allow‑list (globs) for archiving logic; overrides excludes when present.
- `excludes`: deny‑list (globs) for archiving logic.
- `scripts`: keys and commands to run under `stan run`.
- Optional:
  - `maxUndos`: number (default 10), retained snapshot history.
  - `patchOpenCommand`: editor open command template (default `code -g {file}`).

---

## Run (build & snapshot)

```
stan run [options]
```

Defaults:

- No flags: run all configured scripts and create `archive.tar` and `archive.diff.tar`.
- Use `-A/--no-archive` to skip creating archives.
- Use `-S/--no-scripts` to skip running scripts (together with `-A` prints the plan only).

Selection:

- `-s, --scripts [keys...]`: run only these keys. If no keys listed, run all.
- `-x, --except-scripts <keys...>`: exclude keys. If `-s` present, reduces that set; otherwise reduces from full set.

Execution & outputs:

- `-q, --sequential`: run sequentially. With `-s`, preserves the listed order; without `-s`, uses config order.
- `-c, --combine`: include script outputs inside archives and remove from disk. Implies `--archive` and requires `-s` or `-x`. Conflicts with `--keep`.
- `-k, --keep`: do not clear the output directory before running (conflicts with `--combine`).
- `-A, --no-archive`: do not create archives (overrides the default).
- `-S, --no-scripts`: do not run scripts (conflicts with `-s`/`-x`).
- `-p, --plan`: print the run plan and exit (no side effects).

Global flags:

- `-d, --debug`: verbose streaming of script stdout/stderr.
- `-b, --boring`: disable colorized output (useful for CI).

Behavior highlights:

- Run plan: STAN prints a concise, multi‑line plan (mode, output, scripts, archive/combine/keep).
- Archives:
  - `archive.tar`: full file set filtered by includes/excludes/gitignore/stanPath rules.
  - `archive.diff.tar`: only changed files vs the last recorded snapshot (first time equals full).
- Classification at archive time:
  - Binaries are excluded (summarized to console).
  - Large text candidates are logged (with sizes/LOC), so you can refine excludes.
- Previous archive copy: STAN preserves `diff/archive.prev.tar` for reference.

---

## Archiving & snapshot (share & baseline)

### Snapshots

- Diff snapshot file: `<stanPath>/diff/.archive.snapshot.json`.
- Normal runs: create a snapshot only when one does not exist.
- Explicit reset/update: use `stan snap` any time to replace the snapshot.

### `stan snap` (and history)

```
stan snap
stan snap undo
stan snap redo
stan snap set <index>
stan snap info
```

- History:
  - `snap`: write new snapshot; pushes history stack and clears redos.
  - `undo`: move to previous entry and restore it.
  - `redo`: move forward and restore it.
  - `set <index>`: jump to a specific entry and restore it.
  - `info`: lists newest→oldest, with local timestamps and markers.
- Stash (optional):
  - `stan snap -s` runs `git stash -u` before snapshot, attempts `stash pop` after.
  - On stash failure: snapshot aborted (no change).
- Archives at snap time:
  - If `<stanPath>/output/archive*.tar` exist, they’re copied into `<stanPath>/diff/archives/` alongside the snapshot for traceability.
- Retention:
  - `maxUndos` (default 10) controls bounded history.

---

## Chat and bootloader (share & baseline)

When you attach archives, include the system prompt bootloader:

- Bootloader path (downstream repos): `<stanPath>/system/stan.bootloader.md`.
- From the npm package for convenience: `node_modules/@karmaniverous/stan/dist/stan.bootloader.md` (we also ship `stan.system.md` and `stan.project.template.md` in `dist/`).

How it works:

- Integrity‑check tar(s): enumerate and verify each entry’s length matches header size.
- Resolve repo root and `stanPath` from `stan.config.*`.
- Load `<stanPath>/system/stan.system.md` as the active system prompt (mandatory override) and proceed under those rules.

If missing:

- The assistant should refuse to proceed and request a tar containing `<stanPath>/system/stan.system.md` or a file named exactly `stan.system.md`.

---

## Discuss & patch (discuss & patch)

### `stan patch` (pipeline & FEEDBACK)

Common flows:

```
# Apply from clipboard (default)
stan patch

# Validate without changing files
stan patch --check

# Read from a file (unified diff) and apply
stan patch -f my.patch

# Validate a patch file only
stan patch -f my.patch --check

# Pass a diff inline (watch shell limits on very large diffs)
stan patch "diff --git a/x b/x
--- a/x
+++ b/x
@@ -1,1 +1,1 @@
-old
+new"
```

What it does:

- Cleans input and writes canonical `<stanPath>/patch/.patch` (workspace).
- Attempts to apply:
  - `git apply` tolerant modes across `-p1` then `-p0`.
  - jsdiff fallback for line‑wise placement when necessary.
- After success (non‑`--check`):
  - Opens modified files in your editor (configurable via `patchOpenCommand`, default `code -g {file}`).
  - Prints a commit message (from the assistant) to use as your commit.
- After failure or partial success:
  - Writes diagnostics under `<stanPath>/patch/.debug/`:
    - `cleaned.patch`, `attempts.json`, per‑attempt `*.stderr.txt`/`*.stdout.txt`.
  - Produces a compact FEEDBACK envelope and copies it to clipboard when possible so you can paste back into chat for a corrected patch.
  - Moves any new `*.rej` rejects to `<stanPath>/patch/rejects/<UTC timestamp>/`, preserving paths.
  - Opens header‑derived target files to speed manual edits (non‑`--check`).

Sources and precedence:

- `[input]` argument > `-f <file>` > clipboard.
- If the input looks like base64, STAN tries to decode it only if it yields a unified diff.

Patch format expectations:

- Plain unified diffs (no base64) with a/ and b/ prefixes and ≥3 lines of context per hunk.
- LF endings in the patch; CRLF translation handled when applying.

---

## Includes, excludes, and gitignore

STAN determines the file set by:

- Your configured `includes` (allow‑list) and `excludes` (deny‑list) with glob support.
- `.gitignore` semantics (via the `ignore` library).
- Defaults:
  - Excludes `node_modules/`, `.git/`, `<stanPath>/diff`, and `<stanPath>/output` (unless `--combine`/include‑outputs mode is active).
  - Always includes `<stanPath>/patch` in archives for patch workflows.

---

## Preflight and version awareness

On `stan run`, preflight:

- Warn if local system prompt differs from baseline.
- Nudge to run `stan init` after upgrades if packaged docs changed since last install (tracked via `<stanPath>/system/.docs.meta.json`).

Version printing:

```
stan --version
```

Prints:

- STAN version + Node version
- Repo root + resolved `stanPath`
- System prompt in‑sync status (local and baseline presence)
- Last installed docs version

---

## Large files (> 300 LOC)

To keep patches focused and modules testable, STAN flags any source file longer than ~300 lines and asks for a plan.

Assistant checklist example:

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

No changes are made automatically; the assistant waits for confirmation before emitting patches.

---

## Bootstrapping & scripts

Handy scripts you might keep in `package.json`:

- `stan:build`: build CLI and copy docs into `<stanPath>/dist` as needed.
- `stan:docs`: generate docs (e.g., with typedoc).
- `lint`, `test`, `typecheck`, `build`: whatever your toolchain uses; reference them in `stan.config.*`.

---

## Troubleshooting

- “system prompt missing”: Ensure `<stanPath>/system/stan.system.md` is in the attached archive; otherwise add the file or attach it directly as `stan.system.md`.
- Big archives: If you’re struggling with size, favor `archive.diff.tar` plus script outputs for iterations; the full archive’s only needed occasionally.
- Windows command limits: For very large diffs, prefer clipboard or `-f` over inline argument input.
- Clipboard in CI/tests: STAN skips clipboard writes during tests unless explicitly forced to avoid process hangs and file lock issues.

---

## Reference cheatsheet

- Build & Snapshot
  - `stan run` (run all configured scripts and archive - default)
  - `stan run -p` (print plan; no side effects)
  - `stan run -S -A` (nothing to do; print plan)
  - `stan run -s test typecheck` (run selected)
  - `stan run -x lint` (run all except lint)
  - `stan run -c -s` (include outputs inside archives and remove from disk)
- Share & Baseline
  - Attach `archive.tar` (+ `archive.diff.tar`) and outputs
  - `stan snap` / `undo` / `redo` / `set <n>` / `info`
- Discuss & Patch
  - `stan patch` (clipboard)
  - `stan patch -f some.patch` (from file)
  - `stan patch --check` (validate only)

---

## Contributing

- Keep the loop simple. Each stage ends with one command.
- Favor small, testable modules; treat >300 LOC as design feedback.
- Improve the project prompt (`<stanPath>/system/stan.project.md`) when repo‑specific policies evolve; downstream repos should avoid changing the system prompt (it is updated by `stan init` from the packaged baseline).

---

## License

BSD‑3‑Clause

---

## Appendix: Files and layout

By default (`stanPath: .stan`):

- `.stan/system/` — prompts & templates
  - `stan.system.md` — system prompt (governs assistant behavior)
  - `stan.bootloader.md` — bootloader prompt for assistants
  - `stan.project.template.md` — project prompt template
  - `.docs.meta.json` — last installed docs version (for preflight nudges)
- `.stan/output/` — run outputs and archives
  - `*.txt` — deterministic script logs
  - `archive.tar` — full archive
  - `archive.diff.tar` — diff archive
- `.stan/diff/` — snapshot & history
  - `.archive.snapshot.json` — current snapshot
  - `.snap.state.json` — history state
  - `snapshots/` — retained snapshots
  - `archives/` — archived artifacts captured at snap time
  - `.stan_no_changes` — sentinel included when no diffs
- `.stan/patch/` — patch workspace
  - `.patch` — canonical cleaned patch file
  - `.debug/` — attempts & logs, feedback.txt
  - `rejects/<UTC>/...` — collected `*.rej` files

Diagrams:

- `diagrams/stan-loop.pu` — the simplified three‑stage PlantUML source
- Render to `diagrams/stan-loop.svg` (or PNG) in CI/docs as desired.
