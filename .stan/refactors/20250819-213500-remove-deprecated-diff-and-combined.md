# Refactor: remove deprecated --diff and combinedFileName

When: 2025-08-19T21:35:00Z
Why: System-level directive — do not bend code to obsolete tests. The --diff flag is deprecated (diff tar is always created with --archive). Combined artifacts were removed from the design. Tests and init flow must reflect current requirements.
What changed:

- src/cli/stan/runner.test.ts: removed `diff` flag usage and stray `combinedFileName` from config stub.
- src/cli/stan/init.ts: removed `combinedFileName` prompts/persistence; typed inquirer answers to satisfy ESLint safety rules; config now matches stan.project.md.
  Tests/Lint:
- Typecheck: resolves TS2353 on `diff` and all `combinedFileName` type errors.
- Lint: clears unsafe assignment/argument warnings in init.ts.
  Links:
- Spec: stan.project.md (“Archives & outputs”, Context Config Shape)
  Next:
- If other tests mention deprecated options in future, update them to the current CLI surface.
