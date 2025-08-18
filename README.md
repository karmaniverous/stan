# requirements.md

## Global Requirements

- **No backward‑compat shims** before first release. Keep the code & tests aligned with the **current** API.
- **Path alias**: Use `@/*` for all non‑sibling imports.
  - Tooling support:
    - TypeScript: `compilerOptions.baseUrl="."`, `paths={"@/*":["src/*"]}`
    - Rollup: alias `'@' -> './src'`
    - Vitest (Vite): `resolve.alias['@'] = <repo>/src`
- **Global install robustness**: Resolve package **root** from `cwd` using [`package-directory`](https://www.npmjs.com/package/package-directory) (both async and sync). Fallback to `cwd` when no `package.json` is found.

## Configuration (`stan.config.json|yml`)

```ts
type ScriptMap = Record<string, string>;

type ContextConfig = {
  /** Output dir, relative to package root (resolved via package-directory). */
  outputPath: string;

  /** Map of script keys to shell commands. Reserved keys: "archive", "init" are disallowed. */
  scripts: ScriptMap;

  /**
   * Optional lists of repo‑relative paths (files or directories).
   * - `includes`: if provided, only files under these prefixes are considered by features that enumerate files.
   * - `excludes`: explicit exclusions that win over defaults and any gitignore behavior.
   * These override any implicit ignore logic in this tool; they do NOT change your .gitignore file.
   */
  includes?: string[];
  excludes?: string[];
};
```

## CLI

- `stan` commands:
  - `stan` (runner): executes scripts by keys; flags:
    - `-e/--except <keys...>` run everything except listed keys
    - `-s/--sequential` run in series
    - `-c/--combine` produce combined outputs (`combined.txt` or `*.tar` when `archive` is selected)
    - `-k/--keep` do not clear output directory between runs
    - `-d/--diff` produce `archive.diff.tar` when `archive` is selected
    - `--combined-file-name <name>` override base name for combined artifacts
  - `stan init` scaffolds `stan.config.json|yml` (interactive by default, `--force` for non‑interactive).

## Archiving & Diff

- `archive.tar` is created **under** `outputPath`. By default the output directory is **excluded** to avoid recursion; combined `*.tar` sets `includeOutputDir: true`.
- `archive.diff.tar` always exists when requested; if no changes are detected a placeholder file `.stan_no_changes` is included.

## Linting & Testing

- ESLint lints TypeScript and JSON files; scopes discovery to repo files only (avoids scanning transient paths like `coverage/**`).
- `vitest` excludes caches and uses `happy-dom`.

