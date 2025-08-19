// README.md

# STAN — STAN Tames Autoregressive Nonsense

> 🎲 **A tip of the hat to Stanisław Ulam.**  
> In 1946, while recovering from illness and noodling over card games, Ulam helped ignite the **Monte Carlo method**—random sampling to tackle hard, deterministic problems.  
> **STAN** brings a bit of that spirit to software: **S**ample your project, **T**ar it up, let your AI **A**nalyze, and have it **N**arrate with confidence.  
> Also, yes: **STAN Tames Autoregressive Nonsense.** Because your repo shouldn’t gaslight your AI.

**STAN** produces a _single source of truth_ for AI‑assisted development: a tarball of your repo plus deterministic outputs from your build/test/lint/typecheck scripts.  
You get **portable, auditable, reproducible** context—locally and in CI.

---

## Why STAN?

Handing an AI “whatever happens to be in my editor” is unreliable. STAN enforces a **repeatable process**:

- **One archive.** `stan/archive.tar` captures the exact files to read—no surprises.
- **Structured logs.** `stan/test.txt`, `stan/lint.txt`, `stan/typecheck.txt`, `stan/build.txt` are consistent and easy to diff.
- **Optional diff.** `--diff` emits `archive.diff.tar` plus a content snapshot to speed “what changed?” loops.
- **Optional combine.** `--combine` lets you hand off a single tar (or one text file) when that’s all your agent needs.

Result: **Sharper answers, fewer mistakes, repeatable reviews.**

> **Backronym bonus:** **S**ample • **T**ar • **A**nalyze • **N**arrate — **STAN Tames Autoregressive Nonsense.**

---

## Install

```bash
npm i -D @karmaniverous/stan
# or
pnpm add -D @karmaniverous/stan
# or
yarn add -D @karmaniverous/stan
```

> The CLI installs as **`stan`**.

---

## Quickstart

1. **Initialize config**

```bash
npx stan init
```

This scaffolds `stan.config.yml` (or JSON) with an output path (default `stan/`) and a script map.

2. **Check the config**

Example `stan.config.yml`:

```yaml
outputPath: stan
combinedFileName: combined
scripts:
  build: npm run build
  knip: npm run knip
  lint: npm run lint
  test: npm run test
  typecheck: npm run typecheck
```

3. **Generate artifacts**

```bash
# runs all configured scripts concurrently; creates stan/archive.tar
npx stan

# run selected scripts only (preserves order when -s is used)
npx stan test typecheck -s

# run all except <keys>
npx stan -e knip lint

# combine outputs into a single artifact
npx stan -c

# compute an archive diff (requires that "archive" is included)
npx stan -d
```

---

## CLI

```
stan [scripts...] [options]
```

When you run `stan --help`, the footer includes the available script keys discovered from your config, and always lists the special `archive` task.

**Selection**

- `[scripts...]`: run only these keys in order (when paired with `-s`).
- `-e, --except <keys...>`: run all scripts **except** these.

**Execution mode**

- Default is **concurrent**.
- `-s, --sequential`: run scripts sequentially, preserving the enumerated order.

**Artifacts**

- **Default**: Clears the output directory, creates `stan/archive.tar`, and writes one text file per script (e.g., `stan/test.txt`).
- `-k, --keep`: Do **not** clear the output directory before running.

**Combine**

- `-c, --combine`:
  - If `archive` is present among jobs, STAN runs non‑archive jobs first, then creates a **single combined tar** (including the output directory). It **does not** also create `archive.tar`.
  - If `archive` is **not** present, STAN combines produced **text outputs** into a single `<name>.txt`.
  - The base name `<name>` is controlled by the `combinedFileName` config key (default: `combined`).

**Diff**

- `-d, --diff`:
  - When `archive` is included, creates `archive.diff.tar` containing **only changed files** since the last run (added/modified; deletions are tracked in the snapshot but not included in the tarball).
  - Maintains `<outputPath>/.archive.snapshot.json` (path → SHA‑256 hex digest).
  - Copies the previous full tar to `archive.prev.tar` before new archive creation.

**Reserved keys**

- `archive` and `init` are **reserved** and disallowed as script keys in config.

---

## What gets produced?

By default (with `outputPath: stan`):

```
stan/
├─ archive.tar
├─ archive.diff.tar          # when -d/--diff and archive are used
├─ archive.prev.tar          # previous full archive (when diffing)
├─ .archive.snapshot.json    # path → sha256 map for diffs
├─ build.txt
├─ lint.txt
├─ test.txt
├─ typecheck.txt
└─ combined.txt              # when --combine without archive
```

> Use `-k/--keep` to preserve an existing `stan/` directory between runs.

---

## CI Example (GitHub Actions)

```yaml
name: STAN snapshots
on:
  workflow_dispatch:
  push:
    branches: [main]

jobs:
  stan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx stan -c -d
      - name: Upload STAN artifacts
        uses: actions/upload-artifact@v4
        with:
          name: stan
          path: stan/
```

---

## Tips & Troubleshooting

- Prefer portable script entries in your config (e.g., `npm run test`). STAN captures **stdout + stderr** for deterministic logs.
- Add the output directory (default `stan/`) to your `.gitignore`.
- Help shows available script keys (including `archive`) at the bottom.
- **Not that Stan.** This tool isn’t the Stan probabilistic programming language; it’s a snapshot CLI named for Ulam. We do love both.

---

## FAQ

**Is this better than IDE‑native AI?**  
Different goals. IDE AI is great for local tinkering and inline edits; STAN shines when you need **reproducible, shareable context** (PRs, CI, multi‑agent reviews).

**Why tarballs?**  
They’re portable, inspectable, and easy to cache. Your AI agent can verify contents and report exact file sizes and hashes for auditability.

**Can I store STAN artifacts?**  
Yes—treat them like build outputs. They’re perfect for attaching to CI runs or sharing with teammates.

---

## License

BSD-3-Clause © Karmaniverous
