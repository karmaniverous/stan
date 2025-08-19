# Refactor: copy docs to dist & include outputs in combine diff

When: 2025-08-19T20:28:00Z
Why: 1) `stan init` needs stan.system.md/stan.project.template.md available from the published package; 2) In combine mode, the diff archive should include the output directory populated with script outputs.
What changed:

- rollup.config.ts: added `stan-copy-docs` plugin to copy docs into dist root after build.
- src/stan/diff.ts: new option `includeOutputDirInDiff`; tar filter excludes `<outputPath>/.diff`.
- src/stan/run.ts: when `combine` is true and `archive` is included, create diff with `includeOutputDirInDiff: true`.
  Tests/Lint:
- Tests: still pass; existing diff tests unaffected.
- Lint/Typecheck: clean.
  Next:
- Optional: mirror doc copy in `stan.rollup.config.ts` if you want docs in `stan.dist` for dev-only flows (not required for publish).
