# Refactor: add `stan patch` + defaultPatchFile

When: 2025-08-19T17:00:00Z
Why: New workflow directive to ship a copy/paste patch and apply it easily from the CLI. The patch filename should default to a known path.
What changed:

- src/stan/config.ts: added `defaultPatchFile` (default '/stan.patch') to ContextConfig; loaders normalize it.
- src/cli/stan/init.ts: include `defaultPatchFile` in generated config; prefill from existing config when re-running init.
- src/cli/stan/patch.ts: new subcommand to run `git apply --3way` on a patch file (defaults to config).
- src/cli/stan/index.ts: registered the `patch` subcommand.
- stan.project.md: documented `stan patch` and `defaultPatchFile`.
- package.json: redirected `stan:build` log to `stan/rollup.txt` to avoid handle collisions.
  Tests/Lint:
- Existing tests remain unaffected. Lint/typecheck expected to pass.
  Links:
- Patch workflow: save diffs to /stan.patch and run `npx stan patch`.
  Next:
- Optional: add unit tests for `stan patch` with a dummy repo.
