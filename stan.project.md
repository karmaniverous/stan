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

- Root command: `stan`.
- Subcommands:
  - `stan run [scripts...]` — run configured scripts to produce artifacts.
  - `stan init` — scaffold config and docs (`stan.config.yml`, `.gitignore`,
    project docs).
  - `stan snap` — create/replace the diff snapshot (without writing an archive).
  - `stan patch [file]` — apply a git patch (defaults to `defaultPatchFile`).
- Avoid `process.exit()` inside CLI code; use Commander’s `exitOverride()` so
  tests can parse without exiting.
- Help:
  - Native `-h/--help` enabled on root and subcommands.
  - A dynamic help footer lists available script keys from config.
- Selection & execution:
  - When invoked without explicit script keys, `stan run` runs all configured
    scripts.
  - Default mode is concurrent for scripts; sequential preserves enumerated
    order with `-s/--sequential`.
- Archives & outputs (flags):
  - `-a/--archive`: After scripts run, write `archive.tar` and `archive.diff.tar`.
  - `-c/--combine`: Include script outputs inside the archives and do not keep them
    on disk. Implies `--archive` and conflicts with `--keep`.
  - `-k/--keep`: Do not clear the output directory before running. Conflicts with `--combine`.
- Diff snapshot policy:
  - Create snapshot only if missing during runs; `stan snap` replaces it.
  - Snapshot lives under `<outputPath>/.diff/.archive.snapshot.json`.

## Logging

- At the start of `stan run`, print a concise, multi‑line plan summary block
  with clear labels and indentation. Include: mode, output path, scripts,
  and whether archive/combine/keep are enabled.
- For each script/archive action, log `stan: start "<key>"` and
  `stan: done "<key>" -> <relative path>"`.

## Configuration Resolution

- The tool may be installed globally; be robust to arbitrary `cwd`:
  - Resolve the package root using `package-directory`.
  - Look for `stan.config.json|yml` at the package root or current `cwd`.

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

- `includes` and `excludes` are path prefixes (non‑glob) relative to the
  package root.
- Precedence: includes override excludes. When `includes` is defined, it acts
  as an allow‑list (only included prefixes are considered).
- The output directory is excluded from archives unless `--combine` is used
  (in which case it is included and script outputs are not kept on disk).

## UX / Help

- If no scripts are selected or created artifacts array is empty, print the
  available keys: `renderAvailableScriptsHelp(cwd)`.

## Testing (CLI / Commander specifics)

- Use `exitOverride()` on root and subcommands to prevent `process.exit()`
  during tests and to swallow:
  `commander.helpDisplayed`, `commander.unknownCommand`,
  `commander.unknownOption`.
- Prefer `parseAsync(argv, { from: 'user' })` in tests, passing only the user
  tokens (not `node script`), or normalize argv accordingly.
- Capture stdout/stderr to assert help and error messages; you may also
  interrogate `command.helpInformation()` for static help text.
- Use dynamic imports inside command actions so test doubles/mocks can be
  applied before modules are loaded.
- Avoid global `allowUnknownOption(true)` in production code; handle known
  test harness noise with targeted normalization instead.

## Artifacts

- Default output directory is configured by `outputPath` (often `stan/`).
- Per‑script artifacts: `<outputPath>/<key>.txt` combine stdout + stderr.
- Archives (when `--archive` is enabled):
  - `<outputPath>/archive.tar`
  - `<outputPath>/archive.diff.tar`
- Combine behavior (`--combine`):
  - Archives include `<outputPath>` (excluding `<outputPath>/.diff`) and
    script outputs are removed from disk after archiving.

## Notes & Pointers

- This repository uses Node ESM (`"type": "module"`).
- Use `radash` only when it improves clarity & brevity.
