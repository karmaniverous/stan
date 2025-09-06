--- (post‑patch full file content) ---
---

Title: CLI Usage & Examples --- --- The listing below reflects the file after adding --ding/--no-ding and example. ---

---

## title: CLI Usage & Examples

# CLI usage & examples

This page documents all CLI options and shows practical examples. STAN’s CLI honors phase‑scoped defaults from your configuration (cliDefaults) when flags are omitted; see “Config‑driven defaults” below.

## Root (stan) options

- -d, --debug / -D, --no-debug
  - Enable or disable verbose debug logging (default from config; built‑in default false).
  - When enabled, some child process output is mirrored to the console.
- -b, --boring / -B, --no-boring
  - Disable or enable all color/styling (default from config; built‑in default false).
  - When boring mode is on, STAN also sets NO_COLOR=1 and FORCE_COLOR=0.
- -v, --version
  - Print extended version and baseline‑docs status:
    - STAN version, Node version, repo root, stanPath,
    - whether your local system prompt matches the packaged baseline,
    - docs baseline version last installed.

Example:

```
stan -v
```

If you run `stan` with no subcommand and no config is found, STAN starts interactive init. Otherwise it prints the help (with a footer listing available run scripts).

---

## Run — options and defaults

By default, `stan run`:

- runs all configured scripts (concurrent),
- writes both archive.tar and archive.diff.tar.

Flags:

- -s, --scripts [keys...]
  - Select specific script keys. If provided with keys, runs them (order preserved with -q). If provided without keys, selects all known scripts.
  - When -s is omitted, the default selection comes from config (see “Config‑driven defaults”).
- -x, --except-scripts <keys...>
  - Exclude these keys. If -s is present, reduces the -s selection; otherwise reduces from the full set of known scripts.
- -q, --sequential / -Q, --no-sequential
  - Run sequentially (preserves -s order) or concurrently (default).
- -a, --archive / -A, --no-archive
  - Create (or skip) archive.tar and archive.diff.tar. Built‑in default: archive enabled unless explicitly negated. Note: -c implies -a.
- -c, --combine / -C, --no-combine
  - Include .stan/output inside archives and remove outputs from disk (combine mode).
  - Conflicts with -A (cannot combine while disabling archives).
- -k, --keep / -K, --no-keep
  - Keep (do not clear) the output directory across runs.
- -S, --no-scripts
  - Do not run scripts. This conflicts with -s and -x.
  - If combined with -A as well, STAN prints the plan and does nothing else.
- --ding / --no-ding
  - Play (or suppress) a terminal bell on completion. Default can be set via cliDefaults.run.ding.
- -p, --plan
  - Print a concise run plan and exit with no side effects.

Conflicts and special cases:

- -c conflicts with -A (combine implies archives).
- -S conflicts with -s and -x.
- -S plus -A (scripts disabled and archives disabled) => “nothing to do; plan only”.

Examples:

```
# Default: run all scripts and write archives
stan run

# Plan only (no side effects)
stan run -p

# Run a subset
stan run -s test lint

# Run all except a subset
stan run -x test

# Sequential execution (preserves -s order)
stan run -q -s lint test

# Combine mode: include outputs inside archives; remove them from disk
stan run -c

# Keep outputs on disk even after runs
stan run -k

# Disable scripts and archives (plan only)
stan run -S -A -p

# Simple completion bell
stan run --ding
```

--- (remaining sections unchanged) ---
