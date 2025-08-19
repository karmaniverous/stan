# STAN — STAN Tames Autoregressive Nonsense

> 🎲 A tip of the hat to Stanisław Ulam.  
> In 1946, while recovering from illness and noodling over card games, Ulam helped ignite the Monte Carlo method—random sampling to tackle hard, deterministic problems.  
> STAN brings a bit of that spirit to software: Sample your project, Tar it up, let your AI Analyze, and have it Narrate with confidence.  
> Also, yes: STAN Tames Autoregressive Nonsense. Because your repo shouldn’t gaslight your AI.

STAN produces a single source of truth for AI‑assisted development: a tarball of your repo plus deterministic outputs from your build/test/lint/typecheck scripts.  
You get portable, auditable, reproducible context—locally and in CI.

Why STAN?

- One archive (on demand). With -a/--archive, archive.tar captures the exact files to read—no surprises.
- Structured logs. stan/test.txt, stan/lint.txt, stan/typecheck.txt, stan/build.txt are consistent and easy to diff.
- Always-on diffs (when archiving). Whenever you use -a, STAN writes stan/archive.diff.tar for changed files—no extra ceremony. First time? The diff equals the full set (sensible defaults, zero ceremony).
- Snapshot with intent. Normal runs create a snapshot only when missing; use stan snap when you want to reset or replace it. Your diffs stay meaningful.
- Patch on tap. Got a suggested patch from an AI or teammate? Save it and run stan patch to apply it safely at your repo root.
- Simpler combine. With -a -c, script outputs live inside the archives (not on disk). No separate “combined artifact” to maintain.

Backronym bonus: Sample • Tar • Analyze • Narrate — STAN Tames Autoregressive Nonsense.

Install

```
npm i -D @karmaniverous/stan
# or
pnpm add -D @karmaniverous/stan
# or
yarn add -D @karmaniverous/stan
```

The CLI installs as stan.

Quickstart

1. Initialize config

```
npx stan init
```

This scaffolds stan.config.yml (or JSON) with an output path (default stan/) and a script map.

2. Check the config

Example stan.config.yml:

```
outputPath: stan
includes: []
excludes: []
scripts:
  build: npm run build
  knip: npm run knip
  lint: npm run lint
  test: npm run test
  typecheck: npm run typecheck
defaultPatchFile: /stan.patch
```

3. Generate artifacts

```
# Run all configured scripts (no archives by default)
npx stan

# Run selected scripts only (preserves order with -s)
npx stan test typecheck -s

# Run all except <keys>
npx stan -e knip lint

# Produce code archives (regular + diff) after running scripts
npx stan -a

# Put script outputs INSIDE the archives (and do not keep them on disk)
npx stan -a -c
```

Snapshot & Diff (the duo)

- Always-on diffs (with -a): If you pass -a/--archive, STAN writes stan/archive.diff.tar containing only changed files since the last snapshot.
- First-run behavior: No snapshot yet? Your diff equals the full set—simple and predictable.
- Snapshot policy:
  - Normal runs: Create a snapshot only if one does not exist.
  - Explicit reset/update: Use stan snap to (re)write the snapshot on demand.
- Previous full archive: STAN maintains stan/.diff/archive.prev.tar for reference.

CLI

```
stan [scripts...] [options]
```

Options (high level)

- Selection
  - [scripts...]: run only these keys in order (when paired with -s).
  - -e, --except <keys...>: run all scripts except these.
- Execution mode
  - Default is concurrent.
  - -s, --sequential: run scripts sequentially, preserving enumerable order.
- Archives & outputs
  - -a, --archive: after scripts run, write archive.tar and archive.diff.tar.
  - -c, --combine: include script outputs inside the archives and do not keep them on disk. Implies --archive and conflicts with --keep.
  - -k, --keep: do not clear the output directory before running. Conflicts with --combine.
  - -d, --diff: retained for plan display; diff.tar is always created whenever --archive is used.

Artifacts

- Without -a:
  - Per-script artifacts written on disk: <outputPath>/<key>.txt
  - No archives are produced.
- With -a (no -c):
  - Per-script artifacts remain on disk.
  - Archives:
    - <outputPath>/archive.tar (code only; excludes <outputPath>)
    - <outputPath>/archive.diff.tar (changed files only; excludes <outputPath>)
- With -a -c:
  - Script outputs are included inside both archives (archive.tar and archive.diff.tar) and removed from the output directory after archiving.
  - On disk, you will only see:
    - <outputPath>/archive.tar
    - <outputPath>/archive.diff.tar
    - <outputPath>/.diff (snapshot & prev archive)

New: stan snap

Explicitly (re)generate the diff snapshot—without writing an archive:

```
npx stan snap
```

Useful when you want to “re-baseline” diffs after intentional changes.

New: stan patch

Apply a repo-root–relative patch with a single command:

```
# Save a diff to /stan.patch, then:
npx stan patch

# or specify a file:
npx stan patch ./my-fix.patch
```

- Paths beginning with / are treated as repo-root relative for portability.
- Default location is configurable via defaultPatchFile in your config (defaults to /stan.patch).

What gets produced?

By default (with outputPath: stan):

- No -a:
  - stan/
    - build.txt, lint.txt, test.txt, typecheck.txt (as applicable)
- With -a (no -c):
  - stan/
    - build.txt, lint.txt, test.txt, typecheck.txt (as applicable)
    - archive.tar
    - archive.diff.tar
    - .diff/
      - .archive.snapshot.json
      - archive.prev.tar
- With -a -c:
  - stan/
    - archive.tar
    - archive.diff.tar
    - .diff/
      - .archive.snapshot.json
      - archive.prev.tar
  - (Per-script outputs are included inside archives and removed from disk.)

Pro tip: The multi-line plan

Before scripts run, STAN prints a compact, multi-line plan showing your mode, output path, selected scripts, and whether archive/combine/diff/keep are engaged. It’s a quick sanity check that doubles as a log breadcrumb.

CI Example (GitHub Actions)

```
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
      # Produce archives containing outputs; outputs are not kept on disk
      - run: npx stan -a -c
      - name: Upload STAN artifacts
        uses: actions/upload-artifact@v4
        with:
          name: stan
          path: stan/
```

Tips & Troubleshooting

- Prefer portable script entries in your config (e.g., npm run test). STAN captures stdout + stderr for deterministic logs.
- Add the output directory (default stan/) to your .gitignore.
- Don’t see the snapshot you expect? Run npx stan snap to explicitly reset it.

FAQ

Is this better than IDE‑native AI?  
Different goals. IDE AI is great for local tinkering and inline edits; STAN shines when you need reproducible, shareable context (PRs, CI, multi‑agent reviews).

Why tarballs?  
They’re portable, inspectable, and easy to cache. Your AI agent can verify contents and report exact file sizes and hashes for auditability.

Can I store STAN artifacts?  
Yes—treat them like build outputs. They’re perfect for attaching to CI runs or sharing with teammates.

License

BSD-3-Clause © Karmaniverous
