# STAN — STAN Tames Autoregressive Nonsense

[![npm version](https://img.shields.io/npm/v/@karmaniverous/stan.svg)](https://www.npmjs.com/package/@karmaniverous/stan)
![Node Current](https://img.shields.io/node/v/@karmaniverous/stan) <!-- TYPEDOC_EXCLUDE -->
[![docs](https://img.shields.io/badge/docs-website-blue)](https://docs.karmanivero.us/stan)
[![changelog](https://img.shields.io/badge/changelog-latest-blue.svg)](https://github.com/karmaniverous/stan/tree/main/CHANGELOG.md)<!-- /TYPEDOC_EXCLUDE -->
[![license](https://img.shields.io/badge/license-BSD--3--Clause-blue.svg)](https://github.com/karmaniverous/stan/tree/main/LICENSE.md)

![STAN Loop](https://github.com/karmaniverous/stan/raw/main/assets/stan-loop.png)

STAN produces a single source of truth for AI‑assisted development: a tarball of your repo plus deterministic text outputs from your build/test/lint/typecheck scripts.

You get portable, auditable, reproducible context—locally and in CI.

Because a freaking chatbot shouldn’t gaslight your code.

---

## Quick start

1. Install

```
npm i -g @karmaniverous/stan
# or
pnpm add -g @karmaniverous/stan
# or
yarn global add @karmaniverous/stan
```

2. Initialize in your repo

```
stan init
```

- Creates stan.config.yml and scaffolds STAN docs under <stanPath> (default .stan).
- Adds sensible .gitignore entries for <stanPath> subfolders.

3. Run the loop

- Build & Snapshot

```
stan run
```

- Share & Baseline

Attach .stan/output/archive.tar (and archive.diff.tar if present) to your chat.

Optionally run:

```
stan snap
```

- Discuss & Patch

Iterate in chat. Apply suggested patches:

```
stan patch
```

Use --check to validate without changing files, or -f <file> to read from a patch file.

---

## Why STAN?

- Reproducible context: one archive captures exactly the files to read.
- Structured outputs: test/lint/typecheck/build logs are deterministic and easy to diff.
- Always‑on diffs: with --archive, STAN writes archive.diff.tar for changed files automatically.
- Preflight guardrails: nudges you to update prompts when the baseline changes.
- Patch workflow: paste a unified diff or read from a file; STAN applies it safely and opens modified files in your editor.

---

## Configuration (stan.config.yml)

Minimal example:

```
stanPath: .stan
includes: []
excludes: []
scripts:
  build: npm run stan:build
  lint: npm run lint
  test: npm run test
  typecheck: npm run typecheck
```

Optional:

- maxUndos: number of retained snapshot history entries (default 10).
- patchOpenCommand: editor open command (default: "code -g {file}").

---

## Commands at a glance

- Run (build & snapshot)
  - Default: stan run # runs all configured scripts and writes archives
  - stan run -p # print plan only, no side effects
  - stan run -S # do not run scripts (combine with -A/-p)
  - stan run -A # do not create archives
  - stan run -c -s test # include outputs inside archives; remove on-disk outputs
  - stan run -q -s lint test # sequential run in provided order
  - stan run -x test # run all except “test”
- Snap (share & baseline)
  - stan snap
  - stan snap undo | redo | set <index> | info
  - stan snap -s (stash before snap; pop after)
- Patch (discuss & patch)
  - stan patch # from clipboard (default)
  - stan patch --check # validate only
  - stan patch -f file.patch

Global flags:

- -d/--debug (verbose streaming of script stdout/stderr)
- -b/--boring (disable color)

---

## Documentation

- [API reference](https://docs.karmanivero.us/stan)
- Guides:
  - [Getting Started](https://docs.karmanivero.us/stan/documents/Getting_Started.html) — Install the CLI, initialize a repo, attach archives in chat, and use the bootloader with TypingMind (GPT‑5, High reasoning, 128k tokens).
  - [The STAN Loop](https://docs.karmanivero.us/stan/documents/The_STAN_Loop.html) — How Build & Snapshot → Share & Baseline → Discuss & Patch work together.
  - [CLI Usage & Examples](https://docs.karmanivero.us/stan/documents/CLI_Usage___Examples.html) — Common flags and invocation patterns, including `-p`, `-S`, `-A`, and `-c`.
  - [Stan Configuration](https://docs.karmanivero.us/stan/documents/Stan_Configuration.html) — All config keys, includes/excludes semantics, and phase‑scoped CLI defaults.
  - [Patch Workflow & FEEDBACK](https://docs.karmanivero.us/stan/documents/Patch_Workflow___FEEDBACK.html) — Unified diff policy, FEEDBACK envelopes, and assistant expectations.
  - [Archives & Snapshots](https://docs.karmanivero.us/stan/documents/Archives___Snapshots.html) — What goes into `archive.tar`/`archive.diff.tar`, combine mode, and snapshot history.
Additional references:

- The following documents are maintained by STAN and live under `<stanPath>/system/` in your repo:
  - `stan.project.md` contains your evolving project requirements.
  - `stan-todo.md` contains your evolving development plan.
- Case studies:
  - [rrstack](https://docs.karmanivero.us/stan/documents/Case_Study_%E2%80%94_rrstack.html) — how STAN enabled rapid development in a couple of days.
- Comparison: [Why STAN Over Alternatives?](https://docs.karmanivero.us/stan/documents/Why_STAN_Over_Alternatives_.html)
- Tutorial: [Quickstart (End‑to‑End)](<https://docs.karmanivero.us/stan/documents/Tutorial_%E2%80%94_Quickstart_(End%E2%80%91to%E2%80%91End).html>)
- FAQ: answers to common questions and pitfalls.
- Contributing: [Dev Quickstart](https://docs.karmanivero.us/stan/documents/Contributing_%E2%80%94_Dev_Quickstart.html)

---

## Troubleshooting

- “system prompt missing”: ensure <stanPath>/system/stan.system.md is included in the attached archive; otherwise attach it directly as stan.system.md.
- Patch failures: use --check to validate first; if a patch fails, STAN writes a compact FEEDBACK envelope and (when possible) copies it to your clipboard so you can get a corrected patch.
- Large files: STAN may flag very long source files (~300+ LOC) and ask for a split plan before proceeding.

---

## Contributing

- See the [Contributing — Dev Quickstart](https://docs.karmanivero.us/stan/documents/Contributing_%E2%80%94_Dev_Quickstart.html) for local setup and workflow tips.

- Keep the loop simple. Each stage ends with one command.
- Favor small, testable modules; treat >300 LOC as design feedback.
- Improve the project prompt (<stanPath>/system/stan.project.md) when repo‑specific policies evolve.

---

## License

BSD‑3‑Clause
