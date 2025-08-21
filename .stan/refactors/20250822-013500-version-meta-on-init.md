# Refactor: write docs metadata on init
When: 2025-08-22T01:35:00Z (UTC)
Why: Preflight/-v can report “docs last installed” only if <stanPath>/system/.docs.meta.json exists. Init should record the package version when installing/updating prompts.
What changed:
- src/cli/stan/init.ts: after copying docs into <stanPath>/system, write .docs.meta.json with { "version": "<package.version>" } (best-effort).
- .stan/system/stan.todo.md: marked P2 “Version metadata on init” as done; removed the “init does not write it yet” note.

Tests/Lint:
- No new tests added (behavior is side-effectful and best-effort). Existing suites remain green.
- Lint/typecheck/docs: unaffected.

Next:
- P3 Archive classifier (binary/large) per plan.

