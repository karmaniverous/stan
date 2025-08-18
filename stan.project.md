// stan.project.md

# Global & Cross‑Cutting Requirements

This document is the single source of truth for project‑wide requirements. Individual files should not duplicate these; instead they include a short header like:

> `/** See /stan.project.md for global requirements. */`

## TypeScript

- **No `any`.** Prefer precise types and `unknown` + narrowing when needed.
- **No type parameter defaults** that hide inference.
- **Arrow functions** for all functions.
- **Consistent naming** for variables/types/params.
- **Use path alias** `@/*` for all non‑sibling imports. The alias is defined in `tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "baseUrl": ".",
      "paths": { "@/*": ["src/*"] }
    }
  }
  ```

## Linting & Formatting

- ESLint 9 flat config with:
  - Base JS rules (`@eslint/js`).
  - TypeScript via `typescript-eslint` (_type‑aware rules only under `src/**`_).
  - Import sorting via `eslint-plugin-simple-import-sort`.
  - Prettier enforced via `eslint-plugin-prettier`.
  - Vitest plugin enabled for `*.test.*` files.
  - JSON linting via `eslint-plugin-jsonc`.
- Target **zero lint errors/warnings**.
- Keep **typed rules** scoped to `src/**` to avoid requiring a TS project for root scripts (e.g., `archive.ts`).

## Testing

- Use **Vitest** with the config in `vitest.config.ts`.
- **Do not change existing test cases** unless necessary to reflect the current design; you may add new cases.
- Only **mock non‑local** dependencies (e.g., `tar`, child processes).
- Tests should assert behavior, not implementation details.

## Build

- Rollup builds:
  - `dist/mjs` + `dist/cjs` (library),
  - `dist/cli` (executables, with shebang),
  - `dist/types` (d.ts bundle).
- Use the `@` alias at build time via Rollup alias config.

## CLI

- Use **`@commander-js/extra-typings`** for typed CLI definitions.
- Export a **`makeCli()`** factory; no compatibility exports for earlier names.
- Avoid `process.exit()` in library/CLI code so tests can run in‑process.
- When executed as a script, run `await makeCli().parseAsync(process.argv)`.
- Help: native `-h/--help` is enabled for the root and subcommands. During tests, `exitOverride` swallows `helpDisplayed` so the process does not exit.
- Default selection: when invoked without explicit script keys, the CLI runs all configured scripts and implicitly adds the special `"archive"` job (unless explicitly excluded via `-e archive`).

## Configuration Resolution

- The tool may be installed **globally**; be robust to arbitrary **cwd**:
  - Resolve the package root using [`package-directory`](https://www.npmjs.com/package/package-directory).
  - Look for `stan.config.json|yml` **at the package root**.

## Context Config Shape

`ContextConfig` (see `src/stan/config.ts`) supports:

```ts
type ContextConfig = {
  outputPath: string;
  scripts: Record<string, string>;
  /** Override .gitignore behavior for archiving (prefix paths, non‑globbing). */
  includes?: string[];
  excludes?: string[];
};
```

- `includes` and `excludes` are **path prefixes** (non‑glob) relative to the package root.
- Precedence: **includes override excludes**. When `includes` is defined, it acts as an allow‑list (only included prefixes are considered).
- The output directory is excluded from archives **unless** `--combine` is used (in which case it is included).

## UX / Help

- If no scripts are selected **or created artifacts array is empty**, print the available keys:
  `renderAvailableScriptsHelp(cwd)`.

## Logging

- Log concise progress lines during runs, for example:
  - `stan: start "test" (node -e "...")`
  - `stan: done "test" in 1.2s -> out/test.txt`

## Artifacts

- The `order.txt` file is a test harness artifact used to assert execution order. It is written only when `NODE_ENV==='test'` or when explicitly enabled by `STAN_WRITE_ORDER=1`. It is not produced during normal CLI runs.

## Misc

- Use Node ESM (`"type": "module"`).
- Use `radash` only when it improves clarity & brevity.
