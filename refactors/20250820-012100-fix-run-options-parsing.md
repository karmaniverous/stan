# Refactor: fix `stan run` options parsing (Commander action args)

When: 2025-08-20T01:21:00Z
Why: Validation erroneously reported “one of -a/-s/-x is required” even when `-a` was present because the action handler treated the Command instance as options.
What changed:

- src/cli/stan/runner.ts: read options from the first action parameter; removed mistaken two-arg signature.
- Validation and selection derivation now see `-a`, `-s`, `-x` correctly.
  Tests/Lint:
- Behavior verified manually; existing unit tests remain applicable.
  Next:
- Optional E2E test to assert `stan run -a` produces archives and does not print the “Available script keys” footer.
