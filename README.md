# project-context (CLI: `ctx`)

Generate a **single snapshot** of your project’s state that an AI can ingest to accelerate dev iterations. It writes:

- a **`archive.tar`** that contains your repository’s current files, and
- one text file per configured script (e.g. `test.txt`, `lint.txt`, `build.txt`, `typecheck.txt`) that captures the command output.

All artifacts are written under an output directory (default **`ctx/`**).

---

## Why?

Handing an AI your repo plus recent build/typecheck/lint/test output is the fastest way to communicate the **deep state** of a codebase. This tool standardizes and automates that process so every iteration is consistent and reproducible.

---

## Install

```bash
# local (recommended)
npm i -D project-context

# or run once via npx
npx project-context init
```

> The CLI name is **`ctx`** to avoid collisions with PowerShell’s `context` built‑in.

---

## Quick start

```bash
# 1) Create a config by scanning your package.json scripts
npx ctx init
#   - Choose JSON or YML
#   - Choose an output directory (default: ctx)
#   - Optionally add that directory to .gitignore

# 2) Generate everything in parallel (archive + scripts)
npx ctx

# 3) Generate just one artifact
npx ctx archive
npx ctx test
```

On completion, the output directory contains:

```
ctx/
  archive.tar
  test.txt
  lint.txt
  build.txt
  typecheck.txt
```

---

## Configuration (`ctx.config.json|yml`)

Example **YML**:

```yml
outputPath: ctx
scripts:
  test: npm run test
  lint: npm run lint
  build: npm run build
  typecheck: npm run typecheck
```

- `outputPath` — directory to write artifacts (relative to repo root).
- `scripts` — keys are your **invocation names** (e.g., `ctx test` writes `ctx/test.txt`), values are **shell commands**.

**Reserved keys**: `archive` and `init` are **not** allowed under `scripts`.

---

## Commands

### `ctx`
Runs **everything in parallel**:
- creates/updates `archive.tar`
- runs each configured script, writing `<key>.txt`

Lifecycle logs are printed for each task:

```
ctx: start "archive"
ctx: start "test" (npm run test)
ctx: done "archive" in 340ms -> ctx/archive.tar (52 files)
ctx: done "test" in 2015ms -> ctx/test.txt
```

### `ctx [key]`
Runs a **single** item. Examples:

```bash
ctx archive
ctx test
```

### `ctx init`
Creates an initial config by **scanning `package.json` scripts**:

- Prompts for **format** (json/yml).
- Prompts for **output directory** (default **`ctx`**).
- Offers to **add that directory to `.gitignore`** (creates it if missing).
- Writes `ctx.config.json|yml`, then shows CLI help.

> Script keys are derived by taking the first word token from each script **title**, resolving duplicates by **shortest title**, and mapping to `npm run <title>`.

### `ctx init -f` / `--force`
Non‑interactive:

- Chooses **YML**
- Sets **`outputPath: ctx`**
- **Adds `/ctx/`** to `.gitignore` (creates file if needed)
- Writes **`ctx.config.yml`** and prints help

---

## Notes & behavior

- The CLI invokes commands via the platform shell (`cmd` on Windows; `sh` on POSIX).
- Failures **do not abort** other concurrent tasks; failures set `process.exitCode = 1`.
- The output directory is always created if missing.

---

## Troubleshooting

- **PowerShell**: `context` collides with built‑ins; this CLI is named **`ctx`**.
- **Windows commands**: Prefer portable scripts (`npm run test`, `echo hi`, etc.). The CLI captures both stdout+stderr for determinism.
- **Artifacts in VCS**: Add your output directory (default `ctx/`) to `.gitignore`. `ctx init` can do this automatically.

---

## License

MIT
