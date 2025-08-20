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
  - `stan patch [file]` — apply a git patch (defaults to `defaultPatchFile`).
- Avoid `process.exit()` inside CLI code; use Commander’s `exitOverride()` so
  tests can parse without exiting.
- Help:
  - Native `-h/--help` enabled on root and subcommands.
  - A dynamic help footer lists available script keys from config.

### Selection & Execution (updated)

- One of `-a/--archive`, `-s/--scripts`, or `-x/--except-scripts` is required.
- `-s, --scripts [keys...]`:
  - Optional variadic.
  - If present with keys: run exactly those keys (filtered to known; preserves order).
  - If present with no keys: run all configured scripts.
- `-x, --except-scripts <keys...>`:
  - Variadic; requires at least one key.
  - If `-s` is present: reduce the `-s` selection by these keys.
  - If `-s` is absent: reduce from the full set of configured scripts (run all minus these keys).
- Execution mode:
  - Default is concurrent.
  - `-q, --sequential` preserves enumerated/config order.
  - `-q` requires either `-s` or `-x`.
- Archives & outputs:
  - `-a/--archive`: After scripts run (or immediately if selection is empty), write `archive.tar` and `archive.diff.tar`.
  - `-c/--combine`: Include script outputs inside the archives and do not keep them on disk. Implies `--archive` and requires `-s` or `-x`. Conflicts with `--keep`.
  - `-k/--keep`: Do not clear the output directory before running. Conflicts with `--combine`.

## Diff snapshot policy

- Create snapshot only if missing during runs; `stan snap` replaces it.
- Snapshot lives under `<outputPath>/.diff/.archive.snapshot.json`.

## Logging

- At the start of `stan run`, print a concise, multi‑line plan summary block
  with clear labels and indentation. Include: mode, output path, scripts,
  and whether archive/combine/keep are enabled.
- For each script/archive action, log `stan: start "<key>"` and
  `stan: done "<key>" -> <relative path>"`.

## Context Config Shape

```ts
type ContextConfig = {
  outputPath: string;
  scripts: Record<string, string>;
  includes?: string[];
  excludes?: string[];
  /** Default patch filename for `stan patch`; defaults to '/stan.patch'. */
  defaultPatchFile?: string;
};
```

- `includes` and `excludes` support picomatch globs; includes override excludes.
- The output directory is excluded from archives unless `--combine` is used
  (in which case it is included and script outputs are not kept on disk).

## UX / Help

- If no scripts are selected and no artifacts are created, print the
  available keys: `renderAvailableScriptsHelp(cwd)`.

## Testing (CLI / Commander specifics)

- Use `exitOverride()` on root and subcommands to prevent `process.exit()` during tests.
- Prefer `parseAsync(argv, { from: 'user' })` in tests or normalize argv accordingly.
- Capture stdout/stderr to assert help and error messages.
- Use dynamic imports inside command actions so test doubles/mocks can be applied.

## Artifacts

- Default output directory is configured by `outputPath` (often `stan/`).
- Per‑script artifacts: `<outputPath>/<key>.txt` combine stdout + stderr.
- Archives (when `--archive` is enabled):
  - `<outputPath>/archive.tar`
  - `<outputPath>/archive.diff.tar`
- Combine behavior (`--combine`):
  - Archives include `<outputPath>` (excluding `<outputPath>/.diff`) and
    script outputs are removed from disk after archiving.
