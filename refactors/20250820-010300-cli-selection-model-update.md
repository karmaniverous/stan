# Refactor: new selection model (-s scripts, -x except, -q sequential)

When: 2025-08-20T01:03:00Z
Why: Align CLI with clearer selection semantics; enforce required flags; globalize debug.
What changed:

- src/cli/stan/runner.ts: replace flags; add validations; remove per-command debug; resolve run cwd via nearest config root.
- src/cli/stan/run-args.ts: derive selection from -s/-x; -q for mode; preserve order/dedupe.
- src/cli/stan/runner.test.ts: updated to -s/-x/-q semantics.
- src/cli/stan/runner.combine.test.ts: updated to require -s/-x for -c/-k/-a case.
- src/stan/help.ts & src/stan/help.test.ts: update examples to new flags.
- README.md & stan.project.md: document new options and usage patterns.
  Tests/Lint:
- Tests updated to new flags; lint/typecheck expected to remain clean.
  Next:
- Optional: E2E CLI tests asserting validations (one-of required; -q/-c require -s or -x).
