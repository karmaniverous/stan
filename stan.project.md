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
- Avoid `process.exit()` inside CLI code; use Commander’s `exitOverride()` so
  tests can parse without exiting.
- Help:
  - Native `-h/--help` enabled on root and subcommands.
  - A dynamic help footer lists available script keys from config, including
    the special `archive` key.
- Selection & execution:
  - When invoked without explicit script keys, `stan run` runs all configured
    scripts and implicitly includes the special `"archive"` job (unless
    excluded via `-e archive`).
  - Default mode is concurrent for non‑archive scripts.
  - Archive execution is serialized: STAN always runs `"archive"` after other
    scripts complete, even in concurrent mode, to avoid file‑handle collisions
    with in‑flight build steps.
- Combine & diff:
  - `-c/--combine`:
    - If `archive` is present, STAN writes a single `<combined>.tar` that
      includes the output directory (no separate `archive.tar`).
    - If `archive` is not present, STAN combines produced **text outputs** into
      a single `<combined>.txt`.
    - The base name is configured by `combinedFileName` (defaults to
      `"combined"`).
  - `-d/--diff`:
    - When `archive` is included, STAN writes `archive.diff.tar` containing
      only changed files since the last run and maintains
      `<outputPath>/.archive.snapshot.json`.
    - Prior full tar is copied to `archive.prev.tar` before new archive
      creation.
- Logging:
  - At the start of `stan run`, print a concise, multi‑line plan summary block
    with clear labels and indentation. Include: mode, output path, scripts,
    and whether archive/combine/diff/keep are enabled.
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
  /** Override .gitignore behavior for archiving (prefix paths, non‑globbing). */
  includes?: string[];
  excludes?: string[];
  /** Base name for combined artifacts; defaults to "combined". */
  combinedFileName?: string;
};
```

- `includes` and `excludes` are path prefixes (non‑glob) relative to the
  package root.
- Precedence: includes override excludes. When `includes` is defined, it acts
  as an allow‑list (only included prefixes are considered).
- The output directory is excluded from archives unless `--combine` is used
  (in which case it is included).

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
- Archive artifacts:
  - `<outputPath>/archive.tar` (when not using `--combine`).
  - `<outputPath>/archive.diff.tar` (with `--diff`).
  - `<outputPath>/archive.prev.tar` (when diffing).
- Combine artifacts:
  - `<outputPath>/<combined>.tar` when `archive` is included.
  - `<outputPath>/<combined>.txt` when `archive` is not included.
- Test harness artifact `order.txt`:
  - Written only when `NODE_ENV==='test'` or `STAN_WRITE_ORDER==='1'`.
  - Not produced during normal CLI runs.

## Notes & Pointers

- This repository uses Node ESM (`"type": "module"`).
- Use `radash` only when it improves clarity & brevity.
