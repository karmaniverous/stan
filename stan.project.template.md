# Project‑Specific Requirements

This file is a template. When `stan.project.md` changes structure, update
this template to match.

General coding and testing standards live in `/stan.system.md`.

## Build

- Rollup builds:
  - `dist/mjs` + `dist/cjs` (library),
  - `dist/cli` (executables, with shebang),
  - `dist/types` (d.ts bundle).
- Use the `@` alias at build time via Rollup alias config.

## CLI (repo tool behavior)

- Root command: `stan`.
- Subcommands:
  - `stan run [scripts...]` — run configured scripts to produce artifacts.
  - `stan init` — scaffold config and docs.
- Avoid `process.exit()` inside CLI code; rely on Commander’s `exitOverride()`.
- Help footer lists configured script keys (incl. `archive`).
- Execution:
  - Default is concurrent for non‑archive scripts.
  - `archive` always runs after other scripts (even in concurrent mode).
- Combine & diff options behave as documented in `stan.project.md`.

## Configuration Resolution

- Resolve package root with `package-directory` and look for
  `stan.config.yml|json` at the root or current `cwd`.

## Context Config Shape

```ts
type ContextConfig = {
  outputPath: string;
  scripts: Record<string, string>;
  includes?: string[];
  excludes?: string[];
  combinedFileName?: string;
};
```

## UX / Help

- If no scripts are selected or nothing was created, print available keys.

## Logging

- Log concise progress lines: `stan: start ...`, `stan: done ... -> path`.

## Artifacts

- See `stan.project.md` for details on per‑script outputs, archives, diffs,
  and combine artifacts.

## Notes & Pointers

- General TypeScript, linting, and testing standards (including Commander
  testing tips) are in `/stan.system.md`.
- Node ESM (`"type": "module"`).
- Use `radash` only where it improves clarity & brevity.
