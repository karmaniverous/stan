# Global & Cross‑Cutting Requirements

This document is the single source of truth for project‑wide requirements. Individual files should not duplicate these; instead they include a short header like:

> `/** See /requirements.md for global requirements. */`

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
  - TypeScript via `typescript-eslint` (*type‑aware rules only under `src/**`*).
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

## Configuration Resolution

- The tool may be installed **globally**; be robust to arbitrary **cwd**:
  - Resolve the package root using [`package-directory`](https://www.npmjs.com/package/package-directory).
  - Look for `stan.config.json|yml` **at the package root**.

## Context Config Shape

`ContextConfig` (see `src/context/config.ts`) supports:

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
- They **override** default ignore behavior. If `includes` is set, only those subpaths are considered. Then `excludes` removes any of those.
- The output directory is excluded from archives **unless** `--combine` is used (in which case it is included).

## UX / Help

- If no scripts are selected **or created artifacts array is empty**, print the available keys:
  `renderAvailableScriptsHelp(cwd)`.

## Logging

- Log concise progress lines during runs, for example:
  - `stan: start "test" (node -e "...")`
  - `stan: done "test" in 1.2s -> out/test.txt`

## Misc

- Use Node ESM (`"type": "module"`).
- Use `radash` only when it improves clarity & brevity.
