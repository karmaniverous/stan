# Global Requirements

This document consolidates all **global & cross‑cutting requirements** for the project. Individual source files now contain a short pointer back to this document instead of duplicating the full lists.

---

## CLI (`ctx`)

- **Root command** runs configured scripts and manages artifacts.
- **Arguments & options**
  - Positional: `[scripts...]` — enumerated script keys.
  - `-e, --except` — treat enumerated keys as an *exclusion* set.
  - `-s, --sequential` — run in sequence; otherwise **concurrent** by default.
  - `-c, --combine` —
    - If **`archive` is included**, create **`<name>.tar`** that *includes the output directory* and do **not** also create `archive.tar`.
    - If **`archive` is not included**, combine per‑script text outputs into **`<name>.txt`** with `BEGIN [key]` / `END [key]` sections.
  - `-k, --keep` — keep existing output directory contents (no clear).
  - `-d, --diff` — when `archive` is included (with or without `--combine`), produce **`archive.diff.tar`**; implies `--keep`.
  - `-n, --name <base>` — base name for combined artifacts (default `combined`).
- **Reserved key:** `archive` triggers archive creation even if not present under `config.scripts`.
- **Sequential ordering:** when not explicitly enumerated, `archive` runs **last**.

## Config

- Look for `ctx.config.json`, `ctx.config.yml`, or `ctx.config.yaml` at repo root.
- Validate shape:
  - `outputPath: string` (non‑empty)
  - `scripts: Record<string,string>`
- Disallow `archive` and `init` under `scripts`.
- Provide both `loadConfig()` (async) and `loadConfigSync()` (sync helper for help text).
- `ensureOutputDir(cwd, outputPath)` creates the destination directory if needed.

## Init (`ctx init`)

- Scaffolds `ctx.config.json` or `ctx.config.yml` if none exists.
- **Default output path**: `ctx`.
- **Interactive mode**: ask for format (json/yml) and output dir; offer to add to `.gitignore`.
- **Non‑interactive (`--force`)**: choose **YML**, use `outputPath=ctx`, add `"/ctx/"` to `.gitignore`, no prompts.
- Derive script keys from `package.json` script titles using the **first `\w+` token**; for duplicates pick the **shortest title**; map to `npm run <title>`.

## Archive

- Default file name: **`archive.tar`** under the configured `outputPath`.
- Create the output directory if missing.
- Exclude the `outputPath` contents from the tarball by default; **include** it when `includeOutputDir: true` (for `--combine`).
- Expose a **testing seam**: `listFilesFn(cwd)` to supply the file list.
- Back‑compat API surface:
  - Old style: `createArchive(cwd, outputPath, { fileName?, includeOutputDir? }) -> string`.
  - New style: `createArchive({ cwd, outputPath, fileName?, includeOutputDir?, listFilesFn? }) -> { archivePath, fileCount }`.

## Diff

- Keep a workspace **snapshot** at `<outputPath>/.archive.snapshot.json` (map of relative POSIX paths to SHA‑256 hex digests).
- On each run with `--diff` and `archive` selected:
  1) Copy `archive.tar` to `archive.prev.tar` if present.
  2) Write `archive.diff.tar` (test sentinel content is `"diff"`).
  3) Save the current snapshot.
- Exclude `node_modules`, `.git`, and the output directory from snapshots and diffs.

## TypeScript / Tooling

- TS config must support modern features used in this repo (ES2022 target/lib) and provide Node + Vitest globals during type‑checks; **no emit**.
- Skip library type checking (`skipLibCheck`).
- ESLint should respect the project style (import sorting, TSDoc hints, Prettier integration) and **ignore** `coverage`, `dist`, `docs`, and `node_modules`.

## Testing

- Tests should couple with the code they cover.
- Extend coverage by adding tests, not by mutating existing cases unless a case is incorrect or ambiguous.
- When a test fails, first confirm intent from the fixtures and requirements above **before** changing implementation.
