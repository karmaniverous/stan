# Refactor: stan patch clipboard default, file mode, check + tolerant apply

When: 2025-08-20T12:30:00Z
Why: Make patches from chat reliable: accept base64 or unified diffs, default to clipboard, add dry-run, clean up content, and apply permissively.
What changed:

- src/stan/patch.ts: new UX and implementation (clipboard default; -f/--file; -c/--check; detection/cleanup; multi-strategy apply with p=1/p=0).
- src/stan/patch.test.ts: tests for clipboard default and -f mode with mocked spawn and clipboard.
- README.md / stan.project.md: updated usage and behavior notes.
  Tests/Lint:
- Unit tests updated and pass under mocked git; lint/typecheck expected clean.
  Next:
- Optional: surface git stderr excerpts on failure when STAN_DEBUG=1; add --strip and --whitespace flags if you want explicit control.
