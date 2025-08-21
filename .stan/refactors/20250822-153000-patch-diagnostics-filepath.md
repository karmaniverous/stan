# Refactor: patch diagnostics log shows file path
When: 2025-08-22T15:30:00Z
Why: On patch failures the CLI logged only the debug directory path (e.g., `.stan/patch/.debug`). Users need the exact file path to diagnostics for quick navigation.
What changed:
- src/stan/patch/index.ts: Log the full relative path to `.stan/patch/.debug/attempts.json` and clarify that per-attempt logs live under the debug directory.

Tests/Lint:
- Tests: unchanged (adapter-only UX change).
- Lint/Typecheck: clean.

Links:
- Artifacts: attempts.json under `.stan/patch/.debug/` plus per-attempt `*.stderr.txt`/`*.stdout.txt`

Next:
- Consider adding a short “open this file” hint for common editors in future (optional).
