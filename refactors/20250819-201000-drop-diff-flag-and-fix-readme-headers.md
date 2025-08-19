# Refactor: drop --diff flag and restore README headers

When: 2025-08-19T20:10:00Z
Why: The run --diff option is obsolete (diff tar is always created with --archive). CLI examples should not show an 'archive' script key. README lost section headers in the last update.
What changed:

- src/cli/stan/runner.ts: removed -d/--diff option and handling.
- src/cli/stan/run-args.ts: removed any “diff” behavior.
- src/stan/run.ts: removed “diff” from plan; RunBehavior now only {archive, combine, keep}.
- src/stan/run.plan.test.ts: updated expectations (no “diff:” line).
- src/stan/help.ts: swapped example ‘-e archive’ with a regular key (no reserved names).
- README.md: restored Markdown headers; removed --diff references; updated examples.
- stan.project.md / stan.project.template.md: removed --diff mention; plan guidance updated.
  Tests/Lint:
- Unit tests updated and expected to pass after changes.
- No new lint issues introduced.
  Links:
- CLI UX: archives & diffs are controlled by -a/--archive; diff is implicit.
