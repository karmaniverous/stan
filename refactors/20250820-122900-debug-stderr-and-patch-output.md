# Refactor: surface git stderr when -d; prep for patch output trials

When: 2025-08-20T12:29:00Z
Why: Improve diagnostics for patch failures without spamming normal runs; begin sharing patches for trial.
What changed:

- src/stan/patch.ts: switched to piped stdio; stream stderr/stdout only when STAN_DEBUG=1; kept multi-strategy apply/check.
- Added human-readable unified diff and instructions for generating/applying base64 safely.
  Tests/Lint:
- Tests unchanged and still passing as they mock spawn; lint/typecheck clean.
  Next:
- If you like this UX, I can also show the last failing attempt’s stderr summary in non-debug mode when all attempts fail.
